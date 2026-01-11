import { Avatar, AvatarProps, Box, CircularProgress, Skeleton, SxProps, Theme } from "@mui/material";
import { FC, ReactNode, useCallback, useState } from "react";
import { Person, Business, Article, AccountBalance } from "@mui/icons-material";
import { environment } from "../environments/environment";

/**
 * Supported entity types for avatar loading.
 * Each type maps to a specific API endpoint pattern.
 */
export type EntityType = 'auditor' | 'protocol' | 'company' | 'report' | 'user';

/**
 * Predefined size configurations for consistent avatar sizing across the app.
 */
export type AvatarSize = 'small' | 'medium' | 'large' | 'xlarge';

/**
 * Loading indicator style options.
 * - 'spinner': Shows a CircularProgress spinner
 * - 'skeleton': Shows a Skeleton animation (good for lists)
 * - 'fade': Uses opacity transition (no explicit loading indicator)
 */
export type LoadingStyle = 'spinner' | 'skeleton' | 'fade';

interface EntityAvatarProps {
    /**
     * The type of entity to load the avatar for.
     * Determines the API endpoint and default fallback icon.
     */
    entityType: EntityType;

    /**
     * The unique identifier of the entity.
     */
    entityId: number;

    /**
     * Predefined size or custom dimensions.
     * - 'small': 32x32px
     * - 'medium': 40x40px (default)
     * - 'large': 60x60px
     * - 'xlarge': 80x80px
     */
    size?: AvatarSize | number;

    /**
     * Custom fallback content to show when image fails to load.
     * If not provided, uses the entity type's default icon.
     */
    fallback?: ReactNode;

    /**
     * Text to use for generating initials fallback.
     * Takes priority over icon fallback when provided.
     */
    fallbackText?: string;

    /**
     * How to display the loading state.
     * - 'spinner': Shows a CircularProgress (default)
     * - 'skeleton': Shows a Skeleton animation
     * - 'fade': Uses opacity transition without indicator
     */
    loadingStyle?: LoadingStyle;

    /**
     * Background color for the avatar when showing fallback content.
     * Accepts theme palette paths like 'primary.main' or 'info.main'.
     */
    bgcolor?: string;

    /**
     * Additional MUI sx props for customization.
     */
    sx?: SxProps<Theme>;

    /**
     * Cache buster timestamp. Pass Date.now() to force image refresh.
     */
    cacheBuster?: number;

    /**
     * Alt text for the avatar image.
     */
    alt?: string;

    /**
     * Callback fired when the image loads successfully.
     */
    onLoad?: () => void;

    /**
     * Callback fired when the image fails to load.
     */
    onError?: () => void;

    /**
     * Additional props passed to the underlying MUI Avatar component.
     */
    avatarProps?: Omit<AvatarProps, 'src' | 'sx' | 'children'>;
}

/**
 * Size configuration mapping for predefined sizes.
 */
const sizeMap: Record<AvatarSize, number> = {
    small: 32,
    medium: 40,
    large: 60,
    xlarge: 80,
};

/**
 * API endpoint patterns for each entity type.
 */
const endpointMap: Record<EntityType, string> = {
    auditor: 'auditors',
    protocol: 'protocols',
    company: 'companies',
    report: 'reports',
    user: 'user',
};

/**
 * Image filename patterns for each entity type.
 */
const imageFileMap: Record<EntityType, string> = {
    auditor: 'image.png',
    protocol: 'image.png',
    company: 'image.png',
    report: 'image.png',
    user: 'avatar.png',
};

/**
 * Default fallback icons for each entity type.
 */
const defaultFallbackIcons: Record<EntityType, ReactNode> = {
    auditor: <Person />,
    protocol: <Business />,
    company: <AccountBalance />,
    report: <Article />,
    user: <Person />,
};

/**
 * Default background colors for each entity type.
 */
const defaultBgColors: Record<EntityType, string> = {
    auditor: 'info.main',
    protocol: 'primary.main',
    company: 'secondary.main',
    report: 'warning.main',
    user: 'primary.main',
};

/**
 * Extracts initials from a name (up to 2 characters).
 */
const getInitials = (name: string): string => {
    return name
        .split(' ')
        .map(word => word.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2);
};

/**
 * EntityAvatar - A reusable async avatar component for loading entity images.
 *
 * This component handles the common pattern of loading avatars from API endpoints
 * with proper loading states, error handling, and fallback content.
 *
 * Features:
 * - Automatic endpoint construction based on entity type
 * - Configurable loading indicators (spinner, skeleton, or fade)
 * - Fallback to initials or icons on error
 * - Consistent sizing with predefined options
 * - Cache busting support for image refresh
 * - Smooth fade-in transitions
 *
 * @example
 * // Basic usage
 * <EntityAvatar entityType="auditor" entityId={123} />
 *
 * @example
 * // With custom size and fallback text
 * <EntityAvatar
 *   entityType="protocol"
 *   entityId={456}
 *   size="large"
 *   fallbackText="Acme Protocol"
 *   loadingStyle="skeleton"
 * />
 *
 * @example
 * // With custom styling
 * <EntityAvatar
 *   entityType="company"
 *   entityId={789}
 *   size={48}
 *   bgcolor="secondary.main"
 *   sx={{ mr: 2, border: '2px solid', borderColor: 'primary.main' }}
 * />
 */
export const EntityAvatar: FC<EntityAvatarProps> = ({
    entityType,
    entityId,
    size = 'medium',
    fallback,
    fallbackText,
    loadingStyle = 'spinner',
    bgcolor,
    sx,
    cacheBuster,
    alt,
    onLoad,
    onError,
    avatarProps,
}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    // Calculate dimensions
    const dimension = typeof size === 'number' ? size : sizeMap[size];

    // Construct image URL
    const endpoint = endpointMap[entityType];
    const imageFile = imageFileMap[entityType];
    const imageUrl = cacheBuster
        ? `${environment.apiUrl}/api/v1/${endpoint}/${entityId}/${imageFile}?t=${cacheBuster}`
        : `${environment.apiUrl}/api/v1/${endpoint}/${entityId}/${imageFile}`;

    // Determine fallback content
    const getFallbackContent = (): ReactNode => {
        if (fallbackText) {
            return getInitials(fallbackText);
        }
        if (fallback) {
            return fallback;
        }
        return defaultFallbackIcons[entityType];
    };

    // Event handlers
    const handleLoad = useCallback(() => {
        setIsLoading(false);
        setHasError(false);
        onLoad?.();
    }, [onLoad]);

    const handleError = useCallback(() => {
        setIsLoading(false);
        setHasError(true);
        onError?.();
    }, [onError]);

    // Calculate spinner size based on avatar size
    const spinnerSize = Math.max(dimension * 0.4, 16);

    // Determine background color
    const avatarBgColor = bgcolor || defaultBgColors[entityType];

    // Calculate font size for initials based on avatar size
    const fontSize = dimension * 0.4;

    // Base avatar styles
    const avatarSx: SxProps<Theme> = {
        width: dimension,
        height: dimension,
        bgcolor: avatarBgColor,
        fontSize: `${fontSize}px`,
        fontWeight: 600,
        ...sx,
    };

    // Render skeleton loading style
    if (loadingStyle === 'skeleton' && isLoading && !hasError) {
        return (
            <Skeleton
                variant="circular"
                width={dimension}
                height={dimension}
                sx={sx}
            />
        );
    }

    // Render avatar with image or fallback
    return (
        <Avatar
            {...avatarProps}
            alt={alt}
            sx={avatarSx}
        >
            {!hasError ? (
                <Box
                    sx={{
                        width: '100%',
                        height: '100%',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {/* Loading indicator for spinner style */}
                    {loadingStyle === 'spinner' && isLoading && (
                        <CircularProgress
                            size={spinnerSize}
                            sx={{
                                color: 'inherit',
                                position: 'absolute',
                                zIndex: 1,
                            }}
                        />
                    )}
                    {/* Image with fade transition */}
                    <img
                        src={imageUrl}
                        alt={alt || `${entityType} avatar`}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: '50%',
                            opacity: isLoading ? 0 : 1,
                            transition: 'opacity 0.2s ease-in-out',
                        }}
                        onLoad={handleLoad}
                        onError={handleError}
                    />
                </Box>
            ) : (
                getFallbackContent()
            )}
        </Avatar>
    );
};

/**
 * Hook for managing entity avatar state externally.
 * Useful when you need more control over the loading state,
 * such as coordinating loading across multiple avatars.
 *
 * @example
 * const { isLoading, hasError, handleLoad, handleError } = useEntityAvatarState();
 *
 * return (
 *   <EntityAvatar
 *     entityType="auditor"
 *     entityId={123}
 *     onLoad={handleLoad}
 *     onError={handleError}
 *   />
 * );
 */
export const useEntityAvatarState = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    const handleLoad = useCallback(() => {
        setIsLoading(false);
        setHasError(false);
    }, []);

    const handleError = useCallback(() => {
        setIsLoading(false);
        setHasError(true);
    }, []);

    const reset = useCallback(() => {
        setIsLoading(true);
        setHasError(false);
    }, []);

    return {
        isLoading,
        hasError,
        handleLoad,
        handleError,
        reset,
    };
};

/**
 * Constructs the avatar URL for an entity.
 * Useful when you need the URL outside of the EntityAvatar component.
 *
 * @param entityType - The type of entity
 * @param entityId - The entity's unique identifier
 * @param cacheBuster - Optional cache buster timestamp
 * @returns The full URL to the entity's avatar image
 */
export const getEntityAvatarUrl = (
    entityType: EntityType,
    entityId: number,
    cacheBuster?: number
): string => {
    const endpoint = endpointMap[entityType];
    const imageFile = imageFileMap[entityType];
    const baseUrl = `${environment.apiUrl}/api/v1/${endpoint}/${entityId}/${imageFile}`;
    return cacheBuster ? `${baseUrl}?t=${cacheBuster}` : baseUrl;
};
