import { FC, useState, MouseEvent } from 'react';
import {
    IconButton,
    Menu,
    MenuItem,
    ListItemText,
    ListItemIcon,
    Typography,
    Divider,
    Box,
    Tooltip
} from '@mui/material';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import AssessmentIcon from '@mui/icons-material/Assessment';
import BugReportIcon from '@mui/icons-material/BugReport';
import { useNavigate } from 'react-router-dom';
import { Bookmark, BookmarkType } from '../../../../../api/soroban-security-portal/models/bookmark';

interface BookmarkMenuProps {
    bookmarks: Bookmark[];
}

export const BookmarkMenu: FC<BookmarkMenuProps> = ({ bookmarks }) => {
    const navigate = useNavigate();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleClick = (event: MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleBookmarkClick = (bookmark: Bookmark) => {
        if (bookmark.bookmarkType === BookmarkType.Report) {
            navigate(`/report/${bookmark.itemId}`);
        } else if (bookmark.bookmarkType === BookmarkType.Vulnerability) {
            navigate(`/vulnerability/${bookmark.itemId}`);
        }
        handleClose();
    };

    const getBookmarkIcon = (type: BookmarkType) => {
        switch (type) {
            case BookmarkType.Report:
                return <AssessmentIcon fontSize="small" />;
            case BookmarkType.Vulnerability:
                return <BugReportIcon fontSize="small" />;
            default:
                return <BookmarksIcon fontSize="small" />;
        }
    };

    const getBookmarkTypeLabel = (type: BookmarkType) => {
        switch (type) {
            case BookmarkType.Report:
                return 'Report';
            case BookmarkType.Vulnerability:
                return 'Vulnerability';
            default:
                return 'Unknown';
        }
    };

    return (
        <>
            <Tooltip title="Bookmarks" arrow>
                <IconButton
                    color="inherit"
                    onClick={handleClick}
                    sx={{ ml: 2 }}
                    aria-label="bookmarks"
                >
                    <BookmarksIcon />
                </IconButton>
            </Tooltip>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                disableScrollLock={true}
                disableAutoFocus={true}
                disableEnforceFocus={true}
                slotProps={{
                    paper: {
                        sx: {
                            maxHeight: 400,
                            width: 320,
                            zIndex: 1200, // Below app bar but above content
                            boxShadow: 3,
                            mt: 0.5, // Small margin below the anchor
                        }
                    },
                    root: {
                        sx: {
                            '& .MuiBackdrop-root': {
                                backgroundColor: 'transparent', // Transparent backdrop
                            }
                        }
                    }
                }}
                sx={{
                    '& .MuiMenu-paper': {
                        overflow: 'visible',
                    }
                }}
            >
                <Box sx={{ px: 2, py: 1 }}>
                    <Typography variant="h6" fontWeight={600}>
                        Bookmarks
                    </Typography>
                </Box>
                <Divider />
                {bookmarks.length === 0 ? (
                    <MenuItem disabled>
                        <ListItemText
                            primary="No bookmarks yet"
                            secondary="Bookmark reports and vulnerabilities"
                        />
                    </MenuItem>
                ) : (
                    bookmarks.map((bookmark) => (
                        <MenuItem
                            key={bookmark.id}
                            onClick={() => handleBookmarkClick(bookmark)}
                        >
                            <ListItemIcon>
                                {getBookmarkIcon(bookmark.bookmarkType)}
                            </ListItemIcon>
                            <ListItemText
                                primary={bookmark.title}
                                secondary={getBookmarkTypeLabel(bookmark.bookmarkType)}
                                slotProps={{
                                    primary: {
                                        noWrap: true,
                                        sx: { fontWeight: 500 }
                                    },
                                    secondary: {
                                        sx: { fontSize: '0.75rem' }
                                    }
                                }}
                            />
                        </MenuItem>
                    ))
                )}
            </Menu>
        </>
    );
};
