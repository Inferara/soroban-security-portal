import { FC, useState } from 'react';
import { IconButton, Stack, Snackbar, Tooltip, Alert } from '@mui/material';
import TwitterIcon from '@mui/icons-material/X';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

export interface ShareButtonsProps {
    title: string;
    url?: string;
}

export const ShareButtons: FC<ShareButtonsProps> = ({ title, url }) => {
    const shareUrl = url || window.location.href;
    const [snackbarOpen, setSnackbarOpen] = useState(false);

    const handleTwitterShare = () => {
        const text = `Check out "${title}" on Soroban Security Portal`;
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
        window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    };

    const handleLinkedInShare = () => {
        const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
        window.open(linkedinUrl, '_blank', 'noopener,noreferrer');
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(shareUrl).then(() => {
            setSnackbarOpen(true);
        });
    };

    return (
        <>
            <Stack direction="row" spacing={1}>
                <Tooltip title="Share on X (Twitter)">
                    <IconButton onClick={handleTwitterShare} size="small" aria-label="share on x">
                        <TwitterIcon fontSize="inherit" />
                    </IconButton>
                </Tooltip>

                <Tooltip title="Share on LinkedIn">
                    <IconButton onClick={handleLinkedInShare} size="small" aria-label="share on linkedin">
                        <LinkedInIcon fontSize="inherit" />
                    </IconButton>
                </Tooltip>

                <Tooltip title="Copy Link">
                    <IconButton onClick={handleCopyLink} size="small" aria-label="copy link">
                        <ContentCopyIcon fontSize="inherit" />
                    </IconButton>
                </Tooltip>
            </Stack>

            <Snackbar
                open={snackbarOpen}
                autoHideDuration={3000}
                onClose={() => setSnackbarOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setSnackbarOpen(false)} severity="success" sx={{ width: '100%' }}>
                    Link copied to clipboard!
                </Alert>
            </Snackbar>
        </>
    );
};
