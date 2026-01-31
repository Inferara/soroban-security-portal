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
} from '@mui/material';
import { Forum as ForumIcon, ChatBubbleOutline, AccessTime } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import ReactGA from 'react-ga4';
import { useForum } from './hooks';
import { ForumCategory } from '../../../../api/soroban-security-portal/models/forum';
import { formatDistanceToNow } from 'date-fns';

export const Forum: FC = () => {
  const navigate = useNavigate();
  const { categories, loading, error } = useForum();

  // Track page view in Google Analytics
  useEffect(() => {
    ReactGA.send({ hitType: 'pageview', page: '/forum', title: 'Forum Categories' });
  }, []);

  const handleCategoryClick = (category: ForumCategory) => {
    navigate(`/forum/c/${category.slug}`);
    ReactGA.event({
      category: 'Forum',
      action: 'category_click',
      label: category.name,
    });
  };

  // Format the last activity timestamp in a human-readable way e.g., "2 hours ago", "3 days ago"
  const formatLastActivity = (dateString: string | null): string => {
    if (!dateString) return 'No activity yet';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  if (loading) {
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

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto' }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h3"
          component="h1"
          sx={{
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            mb: 1,
          }}
        >
          <ForumIcon sx={{ fontSize: 40 }} />
          Forum
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Discuss security topics, share knowledge, and connect with the community.
        </Typography>
      </Box>

      {/* Category List */}
      {categories.length === 0 ? (
        <Alert severity="info">No forum categories available yet. Check back soon!</Alert>
      ) : (
        <Stack spacing={2}>
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onClick={() => handleCategoryClick(category)}
              formatLastActivity={formatLastActivity}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
};

interface CategoryCardProps {
  category: ForumCategory;
  onClick: () => void;
  formatLastActivity: (date: string | null) => string;
}

const CategoryCard: FC<CategoryCardProps> = ({ category, onClick, formatLastActivity }) => {
  return (
    <Card
      sx={{
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 4,
        },
      }}
    >
      <CardActionArea onClick={onClick}>
        <CardContent sx={{ p: 3 }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
            }}
          >
            {/* Category Icon */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 60,
                height: 60,
                borderRadius: 2,
                bgcolor: category.color || 'primary.main',
                color: 'white',
                flexShrink: 0,
              }}
            >
              <ForumIcon sx={{ fontSize: 32 }} />
            </Box>

            {/* Category Info */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 600, mb: 0.5 }}>
                {category.name}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mb: 1.5,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {category.description}
              </Typography>

              {/* Stats Row */}
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 2,
                  alignItems: 'center',
                }}
              >
                {/* Thread Count */}
                <Chip
                  icon={<ChatBubbleOutline sx={{ fontSize: 16 }} />}
                  label={`${category.threadCount} ${category.threadCount === 1 ? 'thread' : 'threads'}`}
                  size="small"
                  variant="outlined"
                />

                {/* Last Activity */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    color: 'text.secondary',
                  }}
                >
                  <AccessTime sx={{ fontSize: 16 }} />
                  <Typography variant="caption">{formatLastActivity(category.lastActivityAt)}</Typography>
                  {category.lastActivityBy && (
                    <Typography variant="caption" sx={{ ml: 0.5 }}>
                      by <strong>{category.lastActivityBy}</strong>
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* Last Thread Title Preview */}
              {category.lastThreadTitle && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    mt: 1,
                    display: 'block',
                    fontStyle: 'italic',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Latest: {category.lastThreadTitle}
                </Typography>
              )}
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default Forum;

