import { FC, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  CircularProgress,
  Alert,
  Stack,
  Chip,
  Button,
  ButtonGroup,
  Pagination,
  Breadcrumbs,
  Link as MuiLink,
  Avatar,
  Tooltip,
} from '@mui/material';
import {
  Forum as ForumIcon,
  ChatBubbleOutline,
  AccessTime,
  Visibility,
  PushPin,
  Lock,
  Add,
  Sort,
  ArrowBack,
} from '@mui/icons-material';
import { useNavigate, Link } from 'react-router-dom';
import ReactGA from 'react-ga4';
import { useCategoryThreads } from './hooks/category-threads.hook';
import { ForumThread, ThreadSortOption } from '../../../../api/soroban-security-portal/models/forum';
import { formatDistanceToNow } from 'date-fns';
import { useAppAuth } from '../../../authentication/useAppAuth';

const SORT_OPTIONS: { value: ThreadSortOption; label: string }[] = [
  { value: 'latest', label: 'Latest' },
  { value: 'most-active', label: 'Most Active' },
  { value: 'newest', label: 'Newest' },
];

export const CategoryThreads: FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAppAuth();

  const {
    slug,
    category,
    threads,
    sortBy,
    setSortBy,
    page,
    setPage,
    totalPages,
    totalCount,
    loading,
    loadingThreads,
    error,
  } = useCategoryThreads();

  // Track page view in Google Analytics
  useEffect(() => {
    if (category) {
      ReactGA.send({
        hitType: 'pageview',
        page: `/forum/c/${slug}`,
        title: `Forum - ${category.name}`,
      });
    }
  }, [category, slug]);

  const handleThreadClick = (thread: ForumThread) => {
    navigate(`/forum/c/${slug}/t/${thread.slug}`);
    ReactGA.event({
      category: 'Forum',
      action: 'thread_click',
      label: thread.title,
    });
  };

  const handleNewThread = () => {
    navigate(`/forum/c/${slug}/new`);
    ReactGA.event({
      category: 'Forum',
      action: 'new_thread_click',
      label: category?.name,
    });
  };

  const formatTime = (dateString: string): string => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  if (loading && !category) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error && !category) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/forum')} sx={{ mt: 2 }}>
          Back to Forum
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto' }}>
      {/* Breadcrumb Navigation */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <MuiLink
          component={Link}
          to="/forum"
          underline="hover"
          color="inherit"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <ForumIcon sx={{ fontSize: 18 }} />
          Forum
        </MuiLink>
        <Typography color="text.primary">{category?.name}</Typography>
      </Breadcrumbs>

      {/* Category Header */}
      <Box sx={{ mb: 4 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: 2,
            mb: 2,
          }}
        >
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 0.5 }}>
              {category?.name}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {category?.description}
            </Typography>
          </Box>

          {/* New Thread Button (authenticated users only) */}
          {isAuthenticated && (
            <Button variant="contained" startIcon={<Add />} onClick={handleNewThread} sx={{ flexShrink: 0 }}>
              New Thread
            </Button>
          )}
        </Box>

        {/* Stats and Controls Row */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: 2,
            mt: 2,
          }}
        >
          {/* Thread Count */}
          <Typography variant="body2" color="text.secondary">
            {totalCount} {totalCount === 1 ? 'thread' : 'threads'}
          </Typography>

          {/* Sort Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Sort sx={{ fontSize: 20, color: 'text.secondary' }} />
            <ButtonGroup size="small" variant="outlined">
              {SORT_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  onClick={() => setSortBy(option.value)}
                  variant={sortBy === option.value ? 'contained' : 'outlined'}
                >
                  {option.label}
                </Button>
              ))}
            </ButtonGroup>
          </Box>
        </Box>
      </Box>

      {/* Thread List */}
      {loadingThreads ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : threads.length === 0 ? (
        <Alert severity="info">
          No threads in this category yet.
          {isAuthenticated ? ' Be the first to start a discussion!' : ' Log in to create a new thread.'}
        </Alert>
      ) : (
        <Stack spacing={1}>
          {threads.map((thread: ForumThread) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              onClick={() => handleThreadClick(thread)}
              formatTime={formatTime}
            />
          ))}
        </Stack>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            mt: 4,
            mb: 2,
          }}
        >
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, newPage) => setPage(newPage)}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </Box>
  );
};

interface ThreadCardProps {
  thread: ForumThread;
  onClick: () => void;
  formatTime: (date: string) => string;
}

const ThreadCard: FC<ThreadCardProps> = ({ thread, onClick, formatTime }) => {
  return (
    <Card
      sx={{
        transition: 'background-color 0.2s',
        '&:hover': {
          bgcolor: 'action.hover',
        },
        // Highlight pinned threads
        ...(thread.isPinned && {
          borderLeft: 3,
          borderColor: 'primary.main',
        }),
      }}
    >
      <CardActionArea onClick={onClick}>
        <CardContent sx={{ py: 2, px: 3 }}>
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              alignItems: 'center',
            }}
          >
            {/* Author Avatar */}
            <Avatar src={thread.authorAvatarUrl} alt={thread.authorName} sx={{ width: 40, height: 40, flexShrink: 0 }}>
              {thread.authorName.charAt(0).toUpperCase()}
            </Avatar>

            {/* Thread Info */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {/* Title Row */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: 0.5,
                }}
              >
                {/* Pinned Icon */}
                {thread.isPinned && (
                  <Tooltip title="Pinned">
                    <PushPin sx={{ fontSize: 16, color: 'primary.main' }} />
                  </Tooltip>
                )}

                {/* Locked Icon */}
                {thread.isLocked && (
                  <Tooltip title="Locked">
                    <Lock sx={{ fontSize: 16, color: 'warning.main' }} />
                  </Tooltip>
                )}

                {/* Thread Title */}
                <Typography
                  variant="subtitle1"
                  component="h3"
                  sx={{
                    fontWeight: thread.isPinned ? 600 : 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {thread.title}
                </Typography>
              </Box>

              {/* Meta Row */}
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: { xs: 1, sm: 2 },
                  alignItems: 'center',
                }}
              >
                {/* Author */}
                <Typography variant="caption" color="text.secondary">
                  by <strong>{thread.authorName}</strong>
                </Typography>

                {/* Reply Count */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    color: 'text.secondary',
                  }}
                >
                  <ChatBubbleOutline sx={{ fontSize: 14 }} />
                  <Typography variant="caption">
                    {thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}
                  </Typography>
                </Box>

                {/* View Count */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    color: 'text.secondary',
                  }}
                >
                  <Visibility sx={{ fontSize: 14 }} />
                  <Typography variant="caption">
                    {thread.viewCount} {thread.viewCount === 1 ? 'view' : 'views'}
                  </Typography>
                </Box>

                {/* Last Activity */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    color: 'text.secondary',
                    ml: 'auto',
                  }}
                >
                  <AccessTime sx={{ fontSize: 14 }} />
                  <Typography variant="caption">{formatTime(thread.lastActivityAt)}</Typography>
                  {thread.lastReplyBy && <Typography variant="caption">by {thread.lastReplyBy}</Typography>}
                </Box>
              </Box>

              {/* Tags */}
              {thread.tags && thread.tags.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                  {thread.tags.slice(0, 3).map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  ))}
                  {thread.tags.length > 3 && (
                    <Chip
                      label={`+${thread.tags.length - 3}`}
                      size="small"
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  )}
                </Box>
              )}
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default CategoryThreads;

