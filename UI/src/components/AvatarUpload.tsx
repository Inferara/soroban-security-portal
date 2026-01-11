import { Avatar, Box, CircularProgress, IconButton, Tooltip } from "@mui/material";
import { FC, useEffect, useRef, useState } from "react";
import { styled } from '@mui/material/styles';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import DeleteIcon from '@mui/icons-material/Delete';
import { showError, showSuccess } from "../features/dialog-handler/dialog-handler";

interface AvatarUploadProps {
    placeholder: string,
    setImageCallback: (base64Image: string | null) => void;
    initialImage: string | null;
    initialImageUrl?: string | null;
}

const ImageControlButton = styled(IconButton)(() => ({
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#ffffff',
    width: 32,
    height: 32,
    border: '2px solid rgba(255, 255, 255, 0.3)',
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        border: '2px solid rgba(255, 255, 255, 0.5)',
        transform: 'scale(1.1)',
    },
    '&:disabled': {
        opacity: 0.5,
    },
}));

export const AvatarUpload: FC<AvatarUploadProps> = ({
    placeholder,
    setImageCallback,
    initialImage,
    initialImageUrl,
}) => {
    const [image, setImage] = useState<string | null>(initialImage);
    const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl ?? null);
    const [isImageUploading, setIsImageUploading] = useState(false);
    const [isImageUrlLoading, setIsImageUrlLoading] = useState(!!initialImageUrl);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setImage(initialImage);
        setImageCallback(initialImage);
    }, [initialImage]);

    useEffect(() => {
        setImageUrl(initialImageUrl ?? null);
        // Start loading state when we have a URL to load
        if (initialImageUrl) {
            setIsImageUrlLoading(true);
        }
    }, [initialImageUrl]);

    const handleImageUrlLoad = () => {
        setIsImageUrlLoading(false);
    };

    const handleImageUrlError = () => {
        setImageUrl(null);
        setIsImageUrlLoading(false);
    };

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                showError('Please select an image file');
                return;
            }

            // Validate file size (max 100KB)
            if (file.size > 100 * 1024) {
                showError('Image size must be less than 100KB');
                return;
            }

            setIsImageUploading(true);
            const reader = new FileReader();
            reader.onloadend = () => {
                try {
                    const result = reader.result as string;
                    // Convert data URL to base64 string (remove the data:image/...;base64, prefix)
                    const base64String = result.split(',')[1];
                    setImage(base64String);
                    setImageUrl(null); // Clear the URL when a new image is uploaded
                    setImageCallback(base64String);
                    showSuccess('Image uploaded successfully');
                } catch (error) {
                    showError('Failed to process image');
                } finally {
                    setIsImageUploading(false);
                }
            };
            reader.onerror = () => {
                showError('Failed to read image file');
                setIsImageUploading(false);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        setImage(null);
        setImageUrl(null);
        setImageCallback(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = ''; // Clear file input value
        }
    };

    // Helper function to determine image type from base64 string
    const getImageSrc = (base64String: string) => {
        // Try to detect image type from the first few characters
        if (base64String.startsWith('/9j/') || base64String.startsWith('/9j/')) {
            return `data:image/jpeg;base64,${base64String}`;
        } else if (base64String.startsWith('iVBORw0KGgo')) {
            return `data:image/png;base64,${base64String}`;
        } else if (base64String.startsWith('R0lGODlh')) {
            return `data:image/gif;base64,${base64String}`;
        } else {
            // Default to JPEG if we can't determine the type
            return `data:image/jpeg;base64,${base64String}`;
        }
    };

    return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ position: 'relative', display: 'inline-block' }}>
                <Avatar
                    sx={{
                        width: 80,
                        height: 80,
                        mr: 3,
                        backgroundColor: '#9386b6', // Purple background
                        border: '3px solid #FCD34D', // Yellow-gold border
                        fontSize: '24px',
                        fontWeight: 'bold',
                    }}>
                    {image ? (
                        <img
                            src={getImageSrc(image)}
                            alt="User avatar"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    ) : imageUrl ? (
                        <>
                            {isImageUrlLoading && (
                                <CircularProgress
                                    size={30}
                                    sx={{
                                        color: '#FCD34D',
                                        position: 'absolute',
                                        zIndex: 1,
                                    }}
                                />
                            )}
                            <img
                                src={imageUrl}
                                alt="User avatar"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    opacity: isImageUrlLoading ? 0 : 1,
                                    transition: 'opacity 0.2s ease-in-out',
                                }}
                                onLoad={handleImageUrlLoad}
                                onError={handleImageUrlError}
                            />
                        </>
                    ) : isImageUrlLoading ? (
                        <CircularProgress size={30} sx={{ color: '#FCD34D' }} />
                    ) : (
                        placeholder
                    )}
                </Avatar>
                <Tooltip title="Upload new avatar" sx={{ mr: 1 }}>
                    <ImageControlButton
                        sx={{ bottom: 0, right: 0 }}
                        onClick={() => fileInputRef.current?.click()}
                        size="small"
                        disabled={isImageUploading}
                    >
                        {isImageUploading ? <CircularProgress size={20} color="inherit" /> : <PhotoCameraIcon fontSize="small" />}
                    </ImageControlButton>
                </Tooltip>
                {(image || imageUrl) && (
                    <Tooltip title="Remove avatar" sx={{ mr: 1 }}>
                        <ImageControlButton
                            sx={{ bottom: 0, right: 0 }}
                            onClick={handleRemoveImage}
                            size="small"
                        >
                            <DeleteIcon fontSize="small" />
                        </ImageControlButton>
                    </Tooltip>
                )}
                <input
                    style={{ display: 'none' }}
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                />
            </Box>            
        </Box>
    );
};
