import { FC, useState, useEffect } from 'react';
import Button from '@mui/material/Button';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useAuth } from 'react-oidc-context';
import { followCall, unfollowCall, isFollowingCall, FollowEntityType } from '../api/soroban-security-portal/soroban-security-portal-api';
import Tooltip from '@mui/material/Tooltip';

interface FollowButtonProps {
    entityType: FollowEntityType;
    entityId: number;
    entityName: string;
}

export const FollowButton: FC<FollowButtonProps> = ({ entityType, entityId, entityName }) => {
    const auth = useAuth();
    const [isFollowing, setIsFollowing] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (auth.isAuthenticated) {
            checkStatus();
        }
    }, [auth.isAuthenticated, entityType, entityId]);

    const checkStatus = async () => {
        try {
            const status = await isFollowingCall(entityType, entityId);
            setIsFollowing(status);
        } catch (error) {
            console.error('Failed to check follow status', error);
        }
    };

    const handleToggleFollow = async () => {
        if (!auth.isAuthenticated) return;

        setLoading(true);
        try {
            if (isFollowing) {
                await unfollowCall(entityType, entityId);
                setIsFollowing(false);
            } else {
                await followCall(entityType, entityId);
                setIsFollowing(true);
            }
        } catch (error) {
            console.error('Failed to toggle follow status', error);
        } finally {
            setLoading(false);
        }
    };

    if (!auth.isAuthenticated) return null;

    return (
        <Tooltip title={isFollowing ? `Unfollow ${entityName}` : `Follow ${entityName} to see updates in your feed`}>
            <Button
                variant={isFollowing ? "contained" : "outlined"}
                color="primary"
                startIcon={isFollowing ? <StarIcon /> : <StarBorderIcon />}
                onClick={handleToggleFollow}
                disabled={loading}
                size="small"
                sx={{ ml: 2 }}
            >
                {isFollowing ? 'Following' : 'Follow'}
            </Button>
        </Tooltip>
    );
};
