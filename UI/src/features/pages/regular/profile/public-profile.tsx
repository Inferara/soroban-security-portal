import { FC, useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Box, Paper, Typography, Chip, CircularProgress, Link as MuiLink, Stack } from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import LanguageIcon from '@mui/icons-material/Language';
import StarIcon from '@mui/icons-material/Star';
import { EntityAvatar } from '../../../../components/EntityAvatar';
import { MarkdownView } from '../../../../components/MarkdownView';
import { getPublicProfileCall } from '../../../../api/soroban-security-portal/soroban-security-portal-api';
import { PublicUserProfile } from '../../../../api/soroban-security-portal/models/profile';

// Read-only public profile for any user, reached by clicking an author's name.
// The endpoint is privacy-safe (no name/email — issue #125); the display name,
// when we have it, comes from the public content the user navigated from.
export const PublicProfile: FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const loginId = Number(id);
  const passedName = (location.state as { name?: string } | null)?.name;

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    getPublicProfileCall(loginId)
      .then((p) => { if (active) setProfile(p); })
      .catch(() => { if (active) setNotFound(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loginId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (notFound || !profile) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
        <Typography variant="h6">Profile not found</Typography>
        <Typography color="text.secondary">This user has no public profile.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <EntityAvatar entityType="user" entityId={loginId} size="large" fallbackText={passedName ?? 'User'} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              {passedName ?? 'Member'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
              <StarIcon sx={{ fontSize: 18, color: 'warning.main' }} />
              <Typography variant="body2">Reputation {profile.reputationScore}</Typography>
            </Box>
          </Box>
        </Box>

        {(profile.location || profile.website) && (
          <Stack direction="row" spacing={3} sx={{ mb: 2, flexWrap: 'wrap' }}>
            {profile.location && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                <LocationOnIcon sx={{ fontSize: 18 }} />
                <Typography variant="body2">{profile.location}</Typography>
              </Box>
            )}
            {profile.website && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <LanguageIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <MuiLink href={profile.website} target="_blank" rel="noopener noreferrer" variant="body2">
                  {profile.website}
                </MuiLink>
              </Box>
            )}
          </Stack>
        )}

        {profile.expertiseTags.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Expertise</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {profile.expertiseTags.map((tag) => (
                <Chip key={tag} label={tag} size="small" />
              ))}
            </Box>
          </Box>
        )}

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>About</Typography>
          {profile.bio ? (
            <MarkdownView content={profile.bio} sx={{ p: 0 }} />
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              This user hasn't added a bio yet.
            </Typography>
          )}
        </Box>
      </Paper>
    </Box>
  );
};
