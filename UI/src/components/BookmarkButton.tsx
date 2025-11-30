import { FC } from 'react';
import { IconButton, Tooltip, CircularProgress } from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import { BookmarkType } from '../api/soroban-security-portal/models/bookmark';

interface BookmarkButtonProps {
    itemId: number;
    bookmarkType: BookmarkType;
    isBookmarked: boolean;
    onToggle: (itemId: number, bookmarkType: BookmarkType) => Promise<boolean>;
    loading?: boolean;
}

export const BookmarkButton: FC<BookmarkButtonProps> = ({
    itemId,
    bookmarkType,
    isBookmarked,
    onToggle,
    loading = false
}) => {
    const handleClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        await onToggle(itemId, bookmarkType);
    };

    const tooltipText = isBookmarked 
        ? `Remove from bookmarks` 
        : `Add to bookmarks`;

    return (
        <Tooltip title={tooltipText} arrow>
            <IconButton
                onClick={handleClick}
                disabled={loading}
                sx={{
                    color: isBookmarked ? 'warning.main' : 'action.active',
                    '&:hover': {
                        color: isBookmarked ? 'warning.dark' : 'warning.main',
                    }
                }}
                aria-label={tooltipText}
            >
                {loading ? (
                    <CircularProgress size={24} />
                ) : isBookmarked ? (
                    <BookmarkIcon />
                ) : (
                    <BookmarkBorderIcon />
                )}
            </IconButton>
        </Tooltip>
    );
};
