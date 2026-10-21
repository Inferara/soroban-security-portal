import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Paper, Typography, Box, Tabs, Tab, IconButton, List, ListItem, ListItemIcon, ListItemSecondaryAction, Chip, Stack, TextField } from '@mui/material';
import { useProfile } from './hooks';
import { styled } from '@mui/material/styles';
import { showError, showSuccess } from '../../../dialog-handler/dialog-handler';
// import LockIcon from '@mui/icons-material/Lock'; // For password change section (commented out)
import EditIcon from '@mui/icons-material/Edit';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import AssessmentIcon from '@mui/icons-material/Assessment';
import BugReportIcon from '@mui/icons-material/BugReport';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import NoteAltIcon from '@mui/icons-material/NoteAlt';
import { MarkdownView } from '../../../../components/MarkdownView';
import { useNavigate } from 'react-router-dom';
import { useBookmarks } from '../../../../contexts/BookmarkContext';
import { BookmarkType } from '../../../../api/soroban-security-portal/models/bookmark';
import { PersonalNote } from '../../../../api/soroban-security-portal/models/personal-note';
import { getPersonalNotesCall, savePersonalNoteCall, deletePersonalNoteCall } from '../../../../api/soroban-security-portal/soroban-security-portal-api';
import { StyledAvatar } from '../../../../components/common/StyledAvatar';
import { ConfirmDialog } from '../../admin/admin-main-window/confirm-dialog';
import { getUserInitials } from '../../../../utils/user-utils';
import { BadgeShowcase } from '../../../../components/BadgeShowcase';
// TODO: replace mockBadges with real badge API (no backend badge endpoint yet)
import { MOCK_BADGES } from '../../../../utils/mockBadges';

const ProfileContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  padding: theme.spacing(3),
  maxWidth: '1400px',
  mx: 'auto'
}));

const ProfileHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: theme.spacing(4),
  padding: theme.spacing(3, 0),
}));

const AvatarContainer = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
}));

// Using shared StyledAvatar from components/common/StyledAvatar.tsx

const UserInfo = styled(Box)(() => ({
  display: 'flex',
  flexDirection: 'column',
}));

const UserName = styled(Typography)(({ theme }) => ({
  fontSize: '1.75rem',
  fontWeight: 600,
  marginBottom: theme.spacing(1),
}));

const UserDetails = styled(Typography)(({ theme }) => ({
  fontSize: '0.875rem',
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(0.5),
}));

const ContentSection = styled(Paper)(({ theme }) => ({
  borderRadius: theme.spacing(2),
  border: '1px solid',
  borderColor: theme.palette.divider,
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  boxShadow: 'none',
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontSize: '1.125rem',
  fontWeight: 600,
  marginBottom: theme.spacing(2),
}));

const PlaceholderText = styled(Typography)(({ theme }) => ({
  fontSize: '0.875rem',
  color: theme.palette.text.secondary,
  fontStyle: 'italic',
}));

const MarkdownContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  backgroundColor: theme.palette.mode === 'light' ? '#fafafa' : '#1a1a1a',
  border: '1px solid',
  borderColor: theme.palette.divider,
  borderRadius: theme.spacing(1),
  '& .markdown-content': {
    fontSize: '0.875rem',
    '& h1, & h2, & h3, & h4, & h5, & h6': {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(1),
    },
    '& p': {
      marginBottom: theme.spacing(1),
    },
    '& ul, & ol': {
      marginBottom: theme.spacing(1),
      paddingLeft: theme.spacing(3),
    },
    '& li': {
      marginBottom: theme.spacing(0.5),
    },
    '& code': {
      backgroundColor: theme.palette.action.hover,
      padding: '2px 4px',
      borderRadius: '4px',
      fontSize: '0.8125rem',
    },
    '& pre': {
      backgroundColor: theme.palette.action.hover,
      padding: theme.spacing(1),
      borderRadius: '4px',
      overflow: 'auto',
    },
    '& blockquote': {
      borderLeft: `4px solid ${theme.palette.primary.main}`,
      paddingLeft: theme.spacing(2),
      marginLeft: 0,
      fontStyle: 'italic',
    },
    '& a': {
      color: theme.palette.primary.main,
      textDecoration: 'none',
      '&:hover': {
        textDecoration: 'underline',
      },
    },
  }
}));

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 0 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `profile-tab-${index}`,
    'aria-controls': `profile-tabpanel-${index}`,
  };
}

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);

  const {
    user,
    userId
  } = useProfile();
  
  const { bookmarks, removeBookmark } = useBookmarks();

  const [personalNotes, setPersonalNotes] = useState<PersonalNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteDraft, setEditingNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<PersonalNote | null>(null);

  const fetchPersonalNotes = useCallback(async () => {
    if (userId !== 0) {
      setPersonalNotes([]);
      return;
    }
    setNotesLoading(true);
    try {
      const notes = await getPersonalNotesCall();
      setPersonalNotes(notes);
    } catch {
      setPersonalNotes([]);
    } finally {
      setNotesLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchPersonalNotes();
  }, [fetchPersonalNotes]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleBookmarkNavigate = (itemId: number, bookmarkType: BookmarkType) => {
    if (bookmarkType === BookmarkType.Report) {
      navigate(`/report/${itemId}`);
    } else if (bookmarkType === BookmarkType.Vulnerability) {
      navigate(`/vulnerability/${itemId}`);
    }
  };

  const handleRemoveBookmark = async (bookmarkId: number) => {
    const success = await removeBookmark(bookmarkId);
    if (success) {
      showSuccess('Bookmark removed successfully');
    } else {
      showError('Failed to remove bookmark');
    }
  };

  const handleStartEditNote = (note: PersonalNote) => {
    setEditingNoteId(note.id);
    setEditingNoteDraft(note.content);
  };

  const handleCancelEditNote = () => {
    setEditingNoteId(null);
    setEditingNoteDraft('');
  };

  const handleSaveEditedNote = async (note: PersonalNote) => {
    const trimmed = editingNoteDraft.trim();
    if (!trimmed) {
      showError('Note content cannot be empty');
      return;
    }
    setSavingNote(true);
    try {
      const updated = await savePersonalNoteCall(note.vulnerabilityId, trimmed);
      setPersonalNotes((prev) =>
        prev.map((item) => (item.id === note.id ? updated : item))
      );
      setEditingNoteId(null);
      setEditingNoteDraft('');
      showSuccess('Personal note updated successfully');
    } catch {
      // RestApi.request has already shown an error popup with the server's message.
    } finally {
      setSavingNote(false);
    }
  };

  const handleRemovePersonalNote = async (noteId: number) => {
    try {
      await deletePersonalNoteCall(noteId);
      setPersonalNotes((prev) => prev.filter((item) => item.id !== noteId));
      if (editingNoteId === noteId) {
        setEditingNoteId(null);
        setEditingNoteDraft('');
      }
      showSuccess('Personal note removed successfully');
    } catch {
      // RestApi.request has already shown an error popup with the server's message.
    }
  };

  const handleConfirmRemovePersonalNote = () => {
    const note = noteToDelete;
    setNoteToDelete(null);
    if (note) {
      void handleRemovePersonalNote(note.id);
    }
  };

  const getBookmarkIcon = (type: BookmarkType) => {
    switch (type) {
      case BookmarkType.Report:
        return <AssessmentIcon />;
      case BookmarkType.Vulnerability:
        return <BugReportIcon />;
      default:
        return <BookmarksIcon />;
    }
  };

  // Using shared getUserInitials from utils/user-utils.ts

  return (
    <ProfileContainer>
      <Box sx={{ margin: '0 auto' }}>
        {/* Profile Header */}
        <ProfileHeader>
          <AvatarContainer>
            <StyledAvatar size="large" sx={{ mr: 3 }}>
              {user?.image ? (
                <img
                  src={`data:image/png;base64,${user.image}`}
                  alt="User avatar"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                getUserInitials(user?.fullName || 'User Name')
              )}
            </StyledAvatar>
            <UserInfo>
              <UserName>
                {user?.fullName}
              </UserName>
              <UserDetails>
                Joined {user?.created ? new Date(user.created).toLocaleDateString() : ''}
              </UserDetails>
              <UserDetails>
                Role: {user?.role ?? 'user'}
              </UserDetails>
            </UserInfo>
          </AvatarContainer>
          {
            userId == 0 && (
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={() => {
                  navigate('/profile/edit');
                }}
              >
                Edit Profile
              </Button>
            )
          }
        </ProfileHeader>

        {/* Tabs Navigation */}
        <Box sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="profile tabs"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 600,
                minHeight: 64
              }
            }}
          >
            <Tab label="Profile" {...a11yProps(0)} />
            <Tab label="Bookmarks" {...a11yProps(1)} />
            <Tab label="Badges" {...a11yProps(2)} />
            {userId == 0 && <Tab label="Notes" {...a11yProps(3)} />}
          </Tabs>
        </Box>

        {/* Tab Panels */}
        <ContentSection>
          <TabPanel value={tabValue} index={0}>
            {/* Personal Information */}
            <Box sx={{ mb: 3 }}>
              <SectionTitle>
                Personal Information
              </SectionTitle>
              {user?.personalInfo ? (
                <MarkdownContainer>
                  <MarkdownView content={user.personalInfo} sx={{ p: 0 }} />
                </MarkdownContainer>
              ) : (
                <PlaceholderText>
                  {userId == 0 ? 'Fill your info in Edit Profile page' : ''}
                </PlaceholderText>
              )}
            </Box>

            {/* Connected Accounts */}
            <Box>
              <SectionTitle>
                Connected accounts
              </SectionTitle>
              <PlaceholderText>
                {user?.connectedAccounts && user?.connectedAccounts.length > 0 ? user?.connectedAccounts.map(account => (
                  <div key={account.serviceName}>
                    {account.serviceName}: {account.accountId}
                  </div>
                )) : (userId == 0 ? 'You can connect accounts in Edit Profile page' : '')}
              </PlaceholderText>
            </Box>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            {/* Bookmarks */}
            <SectionTitle>
              My Bookmarks
            </SectionTitle>
            {bookmarks.length === 0 ? (
              <PlaceholderText>
                No bookmarks yet. Bookmark reports and vulnerabilities to see them here.
              </PlaceholderText>
            ) : (
              <List sx={{ width: '100%' }}>
                {bookmarks.map((bookmark) => (
                  <ListItem
                    key={bookmark.id}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      mb: 2,
                      backgroundColor: 'background.paper',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ color: 'primary.main' }}>
                      {getBookmarkIcon(bookmark.bookmarkType)}
                    </ListItemIcon>
                    <Box sx={{ flexGrow: 1, minWidth: 0, pr: 8 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {bookmark.title}
                      </Typography>
                      {bookmark.description && (
                        <MarkdownView 
                          content={bookmark.description.length > 200 
                            ? bookmark.description.substring(0, 200) + '...' 
                            : bookmark.description
                          } 
                          sx={{
                            p: 0,
                            '& .markdown-content': {
                              fontSize: '0.875rem',
                              color: 'text.secondary',
                              '& p': { margin: 0 },
                              '& h1, & h2, & h3, & h4, & h5, & h6': { 
                                fontSize: '0.875rem',
                                fontWeight: 'normal',
                                margin: 0
                              },
                              '& ul, & ol': { 
                                margin: 0,
                                paddingLeft: 16
                              },
                              '& li': { margin: 0 },
                              '& code': {
                                fontSize: '0.8125rem'
                              }
                            }
                          }}
                        />
                      )}
                    </Box>
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => handleBookmarkNavigate(bookmark.itemId, bookmark.bookmarkType)}
                        sx={{ color: 'primary.main', mr: 1 }}
                        title="Open"
                      >
                        <OpenInNewIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        onClick={() => handleRemoveBookmark(bookmark.id)}
                        sx={{ color: 'error.main' }}
                        title="Remove bookmark"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            {/* Badges — TODO: replace mockBadges with real badge API (no backend badge endpoint yet) */}
            <Alert severity="info" sx={{ mb: 3 }}>
              Badge preview — achievement tracking is coming soon. These are sample badges, not earned achievements.
            </Alert>
            <BadgeShowcase badges={MOCK_BADGES} />
          </TabPanel>

          {userId == 0 && (
            <TabPanel value={tabValue} index={3}>
              {/* Personal Notes */}
              <SectionTitle>
                My Personal Notes
              </SectionTitle>
              {notesLoading ? (
                <PlaceholderText>
                  Loading your personal notes...
                </PlaceholderText>
              ) : personalNotes.length === 0 ? (
                <PlaceholderText>
                  No personal notes yet. Add private notes on vulnerabilities to see them here.
                </PlaceholderText>
              ) : (
                <List sx={{ width: '100%' }}>
                  {personalNotes.map((note) => {
                    // Hidden or deleted vulnerability: keep the note readable and deletable, but it
                    // can't be opened or edited (saving would 404).
                    const isUnavailable = note.isVulnerabilityAvailable === false;
                    return (
                    <ListItem
                      key={note.id}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        mb: 2,
                        backgroundColor: 'background.paper',
                        alignItems: 'flex-start',
                        '&:hover': {
                          backgroundColor: 'action.hover',
                        },
                      }}
                    >
                      <ListItemIcon sx={{ color: 'primary.main', mt: 0.5 }}>
                        <NoteAltIcon />
                      </ListItemIcon>
                      <Box sx={{ flexGrow: 1, minWidth: 0, pr: 12 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5, flexWrap: 'wrap' }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {isUnavailable
                              ? `Vulnerability #${note.vulnerabilityId}`
                              : note.title || `Vulnerability #${note.vulnerabilityId}`}
                          </Typography>
                          {isUnavailable && (
                            <Chip
                              label="No longer available"
                              size="small"
                              color="warning"
                              variant="outlined"
                              sx={{ height: 22, fontSize: '0.75rem' }}
                            />
                          )}
                          {!isUnavailable && note.severity && (
                            <Chip
                              label={note.severity}
                              size="small"
                              variant="outlined"
                              sx={{ height: 22, fontSize: '0.75rem' }}
                            />
                          )}
                        </Stack>

                        {editingNoteId === note.id ? (
                          <Box sx={{ mt: 1 }}>
                            <TextField
                              fullWidth
                              multiline
                              minRows={3}
                              maxRows={8}
                              value={editingNoteDraft}
                              onChange={(e) => setEditingNoteDraft(e.target.value)}
                              disabled={savingNote}
                              slotProps={{
                                htmlInput: {
                                  maxLength: 10000,
                                  'aria-label': 'Edit personal note content',
                                },
                              }}
                              sx={{ mb: 1 }}
                            />
                            <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                              <Button
                                size="small"
                                variant="text"
                                onClick={handleCancelEditNote}
                                disabled={savingNote}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => void handleSaveEditedNote(note)}
                                disabled={savingNote || !editingNoteDraft.trim()}
                              >
                                {savingNote ? 'Saving...' : 'Save Note'}
                              </Button>
                            </Stack>
                          </Box>
                        ) : (
                          <>
                            <MarkdownContainer sx={{ mt: 0.5 }}>
                              <MarkdownView content={note.content} sx={{ p: 0 }} />
                            </MarkdownContainer>
                            {note.updatedAt && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: 'block', mt: 0.5 }}
                              >
                                Updated: {new Date(note.updatedAt).toLocaleString()}
                              </Typography>
                            )}
                          </>
                        )}
                      </Box>
                      <ListItemSecondaryAction sx={{ top: 24 }}>
                        {!isUnavailable && (
                        <>
                        <IconButton
                          edge="end"
                          onClick={() => navigate(`/vulnerability/${note.vulnerabilityId}`)}
                          sx={{ color: 'primary.main', mr: 0.5 }}
                          title="Open vulnerability"
                          aria-label="Open vulnerability"
                        >
                          <OpenInNewIcon />
                        </IconButton>
                        <IconButton
                          edge="end"
                          onClick={() => handleStartEditNote(note)}
                          sx={{ mr: 0.5 }}
                          title="Edit personal note"
                          aria-label="Edit personal note"
                        >
                          <EditIcon />
                        </IconButton>
                        </>
                        )}
                        <IconButton
                          edge="end"
                          onClick={() => setNoteToDelete(note)}
                          sx={{ color: 'error.main' }}
                          title="Remove personal note"
                          aria-label="Remove personal note"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                    );
                  })}
                </List>
              )}
              <ConfirmDialog
                title="Delete personal note?"
                message="This permanently deletes your note. It can't be undone."
                okButtonText="Delete"
                cancelButtonText="Cancel"
                show={noteToDelete !== null}
                onConfirm={handleConfirmRemovePersonalNote}
                onCancel={() => setNoteToDelete(null)}
              />
            </TabPanel>
          )}
        </ContentSection>

        {/* Password Change Section - Hidden by default, can be shown in Edit Profile
        {user?.loginType === "Password" && (
          <ContentSection>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <LockIcon sx={{ mr: 1, color: '#3B82F6' }} />
              <SectionTitle sx={{ mb: 0 }}>
                Change Password
              </SectionTitle>
            </Box>
            <Grid container spacing={2}>
              <Grid size={12}>
                <TextField 
                  fullWidth
                  id="old-password" 
                  label="Current Password" 
                  autoComplete="current-password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  type="password"
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#374151',
                      '& fieldset': {
                        borderColor: '#6B7280',
                      },
                      '&:hover fieldset': {
                        borderColor: '#9CA3AF',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#3B82F6',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: '#9CA3AF',
                    },
                    '& .MuiInputBase-input': {
                      color: '#ffffff',
                    },
                  }}
                />
              </Grid>
              <Grid size={12}>
                <TextField 
                  fullWidth
                  id="new-password" 
                  label="New Password" 
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="password"
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#374151',
                      '& fieldset': {
                        borderColor: '#6B7280',
                      },
                      '&:hover fieldset': {
                        borderColor: '#9CA3AF',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#3B82F6',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: '#9CA3AF',
                    },
                    '& .MuiInputBase-input': {
                      color: '#ffffff',
                    },
                  }}
                />
              </Grid>
              <Grid size={12}>
                <TextField 
                  fullWidth
                  id="confirm-password" 
                  label="Confirm New Password" 
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type="password"
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#374151',
                      '& fieldset': {
                        borderColor: '#6B7280',
                      },
                      '&:hover fieldset': {
                        borderColor: '#9CA3AF',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#3B82F6',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: '#9CA3AF',
                    },
                    '& .MuiInputBase-input': {
                      color: '#ffffff',
                    },
                  }}
                />
              </Grid>
              <Grid size={12}>
                <Button 
                  variant="contained" 
                  onClick={handleChangePassword}
                >
                  Update Password
                </Button>
              </Grid>
            </Grid>
          </ContentSection>
        )}
        */}
      </Box>
    </ProfileContainer>
  );
} 