import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { supabase, supabaseConfigurationError } from '../../lib/supabase';

const IMAGE_BUCKET = 'community-images';
const PAGE_SIZE = 20;
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const POST_FIELDS = 'id,author_username,body,dish_name,image_path,created_at';

type CommunityPost = {
  id: string;
  author_username: string;
  body: string;
  dish_name: string | null;
  image_path: string | null;
  created_at: string;
};

async function fetchPosts(offset: number): Promise<CommunityPost[]> {
  if (!supabase) {
    throw new Error(supabaseConfigurationError ?? 'Community is not configured.');
  }

  const { data, error } = await supabase
    .from('community_posts')
    .select(POST_FIELDS)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  if (error) throw error;
  return (data ?? []) as CommunityPost[];
}

function getImageType(asset: ImagePicker.ImagePickerAsset): { mimeType: string; extension: string } {
  const types: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
  };
  const mimeTypesByExtension: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
  };
  const fileExtension = asset.fileName?.split('.').pop()?.toLowerCase();
  const mimeType = asset.mimeType?.toLowerCase() ??
    (fileExtension ? mimeTypesByExtension[fileExtension] : undefined);
  const extension = mimeType ? types[mimeType] : undefined;
  if (!mimeType || !extension) {
    throw new Error('Choose a JPEG, PNG, WebP, or HEIC image.');
  }
  return { mimeType, extension };
}

function formatPostDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function CommunityScreen() {
  const { user, guest, prepareGuestAccountSignup } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [body, setBody] = useState('');
  const [dishName, setDishName] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetchPosts(0)
      .then((nextPosts) => {
        if (!active) return;
        setPosts(nextPosts);
        setHasMore(nextPosts.length === PAGE_SIZE);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setFeedError(
          loadError instanceof Error ? loadError.message : 'Community posts could not be loaded.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setFeedError(null);
    try {
      const nextPosts = await fetchPosts(posts.length);
      setPosts((current) => [...current, ...nextPosts]);
      setHasMore(nextPosts.length === PAGE_SIZE);
    } catch (loadError) {
      setFeedError(
        loadError instanceof Error ? loadError.message : 'More community posts could not be loaded.',
      );
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, posts.length]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setFeedError(null);
    try {
      const nextPosts = await fetchPosts(0);
      setPosts(nextPosts);
      setHasMore(nextPosts.length === PAGE_SIZE);
    } catch (loadError) {
      setFeedError(
        loadError instanceof Error ? loadError.message : 'Community posts could not be refreshed.',
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  const chooseImage = async () => {
    setActionError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (result.canceled) return;
      const image = result.assets[0];
      if (image.fileSize && image.fileSize > MAX_IMAGE_SIZE) {
        setActionError('Choose an image smaller than 8 MB.');
        return;
      }
      getImageType(image);
      setSelectedImage(image);
    } catch (pickError) {
      setActionError(
        pickError instanceof Error ? pickError.message : 'The selected image could not be opened.',
      );
    }
  };

  const publishPost = async () => {
    if (!supabase) {
      setActionError(supabaseConfigurationError ?? 'Community is not configured.');
      return;
    }
    if (!user) {
      setActionError('Create an account to share a post.');
      return;
    }
    const trimmedBody = body.trim();
    const trimmedDishName = dishName.trim();
    if (!trimmedBody && !trimmedDishName && !selectedImage) {
      setActionError('Add a thought, dish idea, or image before posting.');
      return;
    }
    if (trimmedBody.length > 2000) {
      setActionError('Your post must be 2,000 characters or fewer.');
      return;
    }
    if (trimmedDishName.length > 120) {
      setActionError('Dish names must be 120 characters or fewer.');
      return;
    }

    setPublishing(true);
    setActionError(null);
    let imagePath: string | null = null;
    try {
      if (selectedImage) {
        const { mimeType, extension } = getImageType(selectedImage);
        if (selectedImage.fileSize !== undefined && selectedImage.fileSize > MAX_IMAGE_SIZE) {
          throw new Error('Choose an image smaller than 8 MB.');
        }
        imagePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
        const imageResponse = await fetch(selectedImage.uri);
        if (!imageResponse.ok) throw new Error('The selected image could not be prepared for upload.');
        const imageData = await imageResponse.arrayBuffer();
        const { error: uploadError } = await supabase.storage
          .from(IMAGE_BUCKET)
          .upload(imagePath, imageData, { contentType: mimeType, upsert: false });
        if (uploadError) throw uploadError;
      }

      const { data, error } = await supabase
        .from('community_posts')
        .insert({
          body: trimmedBody,
          dish_name: trimmedDishName || null,
          image_path: imagePath,
        })
        .select(POST_FIELDS)
        .single();
      if (error) throw error;

      setPosts((current) => [data as CommunityPost, ...current]);
      setBody('');
      setDishName('');
      setSelectedImage(null);
    } catch (postError) {
      if (imagePath) {
        try {
          const { error: cleanupError } = await supabase.storage
            .from(IMAGE_BUCKET)
            .remove([imagePath]);
          if (cleanupError) {
            console.error('Could not remove an image after its post failed:', cleanupError.message);
          }
        } catch (cleanupError) {
          console.error(
            'Could not remove an image after its post failed:',
            cleanupError instanceof Error ? cleanupError.message : cleanupError,
          );
        }
      }
      setActionError(
        postError instanceof Error ? postError.message : 'Your post could not be published.',
      );
    } finally {
      setPublishing(false);
    }
  };

  const accountNotice = guest ? (
    <View style={styles.accountNotice}>
      <Text style={styles.accountNoticeText}>
        You can browse the community as a guest. Create an account to share your own posts.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={async () => {
          try {
            await prepareGuestAccountSignup();
          } catch (signupError) {
            setActionError(
              signupError instanceof Error ? signupError.message : 'Account sign-up could not be opened.',
            );
          }
        }}
        style={styles.accountButton}
      >
        <Text style={styles.accountButtonText}>Create account to post</Text>
      </Pressable>
    </View>
  ) : null;

  const composer = (
    <View style={styles.composer}>
      <Text style={styles.sectionTitle}>Share something tasty</Text>
      <Text style={styles.composerHint}>Post a thought, a dish idea, or a photo from your kitchen.</Text>
      {user ? (
        <>
          <TextInput
            accessibilityLabel="Your community post"
            multiline
            maxLength={2000}
            placeholder="What are you cooking or dreaming up?"
            placeholderTextColor="#7A6B5E"
            value={body}
            onChangeText={setBody}
            style={[styles.input, styles.bodyInput]}
            textAlignVertical="top"
          />
          <TextInput
            accessibilityLabel="Dish idea name"
            maxLength={120}
            placeholder="Dish idea (optional)"
            placeholderTextColor="#7A6B5E"
            value={dishName}
            onChangeText={setDishName}
            style={styles.input}
          />
          {selectedImage ? (
            <View style={styles.selectedImageWrap}>
              <Image source={{ uri: selectedImage.uri }} style={styles.selectedImage} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove selected image"
                onPress={() => setSelectedImage(null)}
                style={styles.removeImageButton}
              >
                <Text style={styles.removeImageText}>Remove image</Text>
              </Pressable>
            </View>
          ) : null}
          {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
          <View style={styles.composerActions}>
            <Pressable
              accessibilityRole="button"
              disabled={publishing}
              onPress={chooseImage}
              style={[styles.photoButton, publishing && styles.disabledButton]}
            >
              <Text style={styles.photoButtonText}>{selectedImage ? 'Change photo' : 'Add photo'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={publishing}
              onPress={publishPost}
              style={[styles.publishButton, publishing && styles.disabledButton]}
            >
              <Text style={styles.publishButtonText}>{publishing ? 'Posting…' : 'Share post'}</Text>
            </Pressable>
          </View>
        </>
      ) : (
        accountNotice
      )}
    </View>
  );

  const renderPost = ({ item }: { item: CommunityPost }) => {
    const imageUrl = item.image_path && supabase
      ? supabase.storage.from(IMAGE_BUCKET).getPublicUrl(item.image_path).data.publicUrl
      : null;

    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.author_username.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={styles.authorInfo}>
            <Text style={styles.authorName}>{item.author_username}</Text>
            <Text style={styles.postDate}>{formatPostDate(item.created_at)}</Text>
          </View>
        </View>
        {item.dish_name ? <Text style={styles.dishName}>{item.dish_name}</Text> : null}
        {item.body ? <Text style={styles.postBody}>{item.body}</Text> : null}
        {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.postImage} /> : null}
      </View>
    );
  };

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item.id}
      renderItem={renderPost}
      contentContainerStyle={styles.content}
      ListHeaderComponent={(
        <>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>FOOD IS BETTER SHARED</Text>
            <Text style={styles.title}>Community</Text>
            <Text style={styles.subtitle}>Swap kitchen stories, photos, and your next great dish idea.</Text>
          </View>
          {composer}
          {feedError ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{feedError}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setLoading(true);
                  setFeedError(null);
                  setReloadKey((key) => key + 1);
                }}
              >
                <Text style={styles.retryText}>Try loading again</Text>
              </Pressable>
            </View>
          ) : null}
          <Text style={styles.feedTitle}>Recent posts</Text>
        </>
      )}
      ListEmptyComponent={loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color="#2D6A4F" />
          <Text style={styles.emptyText}>Loading community posts…</Text>
        </View>
      ) : feedError ? undefined : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>A fresh plate</Text>
          <Text style={styles.emptyText}>No posts yet. Share the first kitchen story or dish idea.</Text>
        </View>
      )}
      ListFooterComponent={loadingMore ? (
        <ActivityIndicator style={styles.footerLoader} color="#2D6A4F" />
      ) : hasMore ? (
        <Pressable accessibilityRole="button" onPress={loadMore} style={styles.loadMoreButton}>
          <Text style={styles.loadMoreText}>Load older posts</Text>
        </Pressable>
      ) : undefined}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#2D6A4F" />}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={6}
      windowSize={7}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 36,
    backgroundColor: '#FFF8F0',
    flexGrow: 1,
  },
  hero: {
    paddingTop: 16,
    paddingBottom: 18,
  },
  eyebrow: {
    color: '#C45C26',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 8,
    color: '#7A2E0E',
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 8,
    color: '#5C4A3A',
    fontSize: 16,
    lineHeight: 24,
  },
  composer: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8D5C4',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    color: '#2D6A4F',
    fontSize: 18,
    fontWeight: '800',
  },
  composerHint: {
    marginTop: 4,
    marginBottom: 14,
    color: '#7A6B5E',
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    minHeight: 48,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#D8C4B1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    color: '#3D2B1F',
    fontSize: 16,
  },
  bodyInput: {
    minHeight: 100,
  },
  selectedImageWrap: {
    marginBottom: 12,
  },
  selectedImage: {
    width: '100%',
    height: 190,
    borderRadius: 12,
    backgroundColor: '#F1E7DD',
  },
  removeImageButton: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
  },
  removeImageText: {
    color: '#9A3412',
    fontSize: 13,
    fontWeight: '700',
  },
  composerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  photoButton: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#2D6A4F',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButtonText: {
    color: '#2D6A4F',
    fontSize: 14,
    fontWeight: '800',
  },
  publishButton: {
    minHeight: 46,
    flex: 1,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.55,
  },
  accountNotice: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#EAF2ED',
  },
  accountNoticeText: {
    color: '#3D2B1F',
    fontSize: 14,
    lineHeight: 20,
  },
  accountButton: {
    minHeight: 42,
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  errorText: {
    marginTop: 8,
    color: '#9A3412',
    fontSize: 14,
    lineHeight: 20,
  },
  errorCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFF0EA',
  },
  retryText: {
    marginTop: 8,
    color: '#2D6A4F',
    fontWeight: '800',
  },
  feedTitle: {
    marginTop: 22,
    marginBottom: 12,
    color: '#2D6A4F',
    fontSize: 19,
    fontWeight: '800',
  },
  postCard: {
    marginBottom: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8D5C4',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EAF2ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#2D6A4F',
    fontSize: 16,
    fontWeight: '800',
  },
  authorInfo: {
    marginLeft: 10,
  },
  authorName: {
    color: '#3D2B1F',
    fontSize: 15,
    fontWeight: '800',
  },
  postDate: {
    marginTop: 2,
    color: '#7A6B5E',
    fontSize: 12,
  },
  dishName: {
    marginTop: 12,
    color: '#7A2E0E',
    fontSize: 18,
    fontWeight: '800',
  },
  postBody: {
    marginTop: 10,
    color: '#3D2B1F',
    fontSize: 15,
    lineHeight: 23,
  },
  postImage: {
    width: '100%',
    height: 230,
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#F1E7DD',
  },
  emptyState: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#7A2E0E',
    fontSize: 17,
    fontWeight: '800',
  },
  emptyText: {
    marginTop: 8,
    color: '#7A6B5E',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 18,
  },
  loadMoreButton: {
    minHeight: 46,
    marginVertical: 12,
    borderRadius: 12,
    backgroundColor: '#EAF2ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: {
    color: '#2D6A4F',
    fontWeight: '800',
  },
});
