import { FC, useEffect, useState } from 'react';
import {
    Box,
    Typography,
    Avatar,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Tabs,
    Tab,
    ToggleButton,
    ToggleButtonGroup,
    Stack,
    CircularProgress,
    Tooltip,
} from '@mui/material';
import {
    EmojiEvents as TrophyIcon,
    TrendingUp as UpIcon,
    TrendingDown as DownIcon,
    HorizontalRule as NeutralIcon,
    MilitaryTech as BadgeIcon
} from '@mui/icons-material';
import { useTheme } from '../../../../contexts/ThemeContext';
import { AccentColors } from '../../../../theme';
import {
    TimePeriod,
    LeaderboardCategory,
    LeaderboardEntry
} from '../../../../api/soroban-security-portal/models/leaderboard';
import ReactGA from 'react-ga4';
import { useAuth } from 'react-oidc-context';

export const Leaderboard: FC = () => {
    const { themeMode } = useTheme();
    const auth = useAuth();
    const [period, setPeriod] = useState<TimePeriod>(TimePeriod.AllTime);
    const [category, setCategory] = useState<LeaderboardCategory>(LeaderboardCategory.Overall);
    const [isLoading, setIsLoading] = useState(true);
    const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);

    useEffect(() => {
        ReactGA.send({ hitType: "pageview", page: "/leaderboard", title: "Leaderboard Page" });
    }, []);

    // Simulate data fetching with caching
    useEffect(() => {
        const cacheKey = `leaderboard_${period}_${category}`;
        const cachedData = localStorage.getItem(cacheKey);
        const cacheTime = localStorage.getItem(`${cacheKey}_time`);
        const TTL = 5 * 60 * 1000; // 5 minutes cache

        const fetchLeaderboard = async () => {
            setIsLoading(true);
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 800));

            // Mock data generation
            const mockData: LeaderboardEntry[] = Array.from({ length: 100 }, (_, i) => ({
                rank: i + 1,
                prevRank: i + 1 + (Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0),
                userId: `user-${i}`,
                username: i === 5 ? auth.user?.profile.name || 'Current User' : `Contributor_${i + 1}`,
                reputation: Math.floor(10000 / (i + 1)) + Math.floor(Math.random() * 100),
                badgeCount: Math.floor(20 / (i + 1)) + (i < 5 ? 5 : 0),
                isCurrentUser: i === 5 && !!auth.user,
                avatarUrl: `https://i.pravatar.cc/150?u=user-${i}`
            }));

            setLeaderboardData(mockData);
            localStorage.setItem(cacheKey, JSON.stringify(mockData));
            localStorage.setItem(`${cacheKey}_time`, Date.now().toString());
            setIsLoading(false);
        };

        if (cachedData && cacheTime && (Date.now() - parseInt(cacheTime) < TTL)) {
            setLeaderboardData(JSON.parse(cachedData));
            setIsLoading(false);
        } else {
            fetchLeaderboard();
        }
    }, [period, category, auth.user]);

    const handlePeriodChange = (
        _event: React.MouseEvent<HTMLElement>,
        newPeriod: TimePeriod | null,
    ) => {
        if (newPeriod !== null) {
            setPeriod(newPeriod);
        }
    };

    const handleCategoryChange = (_event: React.SyntheticEvent, newCategory: LeaderboardCategory) => {
        setCategory(newCategory);
    };

    const getRankIcon = (rank: number) => {
        if (rank === 1) return <TrophyIcon sx={{ color: '#FFD700' }} />;
        if (rank === 2) return <TrophyIcon sx={{ color: '#C0C0C0' }} />;
        if (rank === 3) return <TrophyIcon sx={{ color: '#CD7F32' }} />;
        return null;
    };

    const getTrendIcon = (rank: number, prevRank?: number) => {
        if (!prevRank || rank === prevRank) return <NeutralIcon sx={{ color: 'text.disabled', fontSize: 16 }} />;
        if (rank < prevRank) return <UpIcon sx={{ color: 'success.main', fontSize: 16 }} />;
        return <DownIcon sx={{ color: 'error.main', fontSize: 16 }} />;
    };

    return (
        <Box sx={{ p: { xs: 2, md: 4 } }}>
            <Typography variant="h3" sx={{ fontWeight: 700, mb: 4, color: themeMode === 'light' ? '#1A1A1A' : '#F2F2F2' }}>
                LEADERBOARD
            </Typography>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
                <Tabs
                    value={category}
                    onChange={handleCategoryChange}
                    textColor="primary"
                    indicatorColor="primary"
                    sx={{
                        '& .MuiTabs-indicator': { backgroundColor: AccentColors.navigationActive },
                        '& .MuiTab-root': {
                            fontSize: '1.1rem',
                            textTransform: 'none',
                            fontWeight: 600,
                            color: 'text.secondary',
                            '&.Mui-selected': { color: AccentColors.navigationActive }
                        }
                    }}
                >
                    {Object.values(LeaderboardCategory).map((cat) => (
                        <Tab key={cat} label={cat} value={cat} />
                    ))}
                </Tabs>

                <ToggleButtonGroup
                    value={period}
                    exclusive
                    onChange={handlePeriodChange}
                    aria-label="time period"
                    size="small"
                >
                    {Object.values(TimePeriod).map((p) => (
                        <ToggleButton
                            key={p}
                            value={p}
                            sx={{
                                textTransform: 'none',
                                px: 2,
                                '&.Mui-selected': {
                                    backgroundColor: AccentColors.navigationActive,
                                    color: '#000',
                                    '&:hover': { backgroundColor: '#e6c245' }
                                }
                            }}
                        >
                            {p}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
            </Stack>

            <TableContainer component={Paper} sx={{ borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', overflow: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
                <Table stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 800, fontSize: '0.9rem', width: 80 }}>RANK</TableCell>
                            <TableCell sx={{ fontWeight: 800, fontSize: '0.9rem' }}>CONTRIBUTOR</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.9rem' }}>REPUTATION</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.9rem' }}>BADGES</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.9rem', width: 100 }}>TREND</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 10 }}>
                                    <CircularProgress size={40} sx={{ color: AccentColors.loadingIndicator }} />
                                </TableCell>
                            </TableRow>
                        ) : (
                            leaderboardData.map((row) => (
                                <TableRow
                                    key={row.userId}
                                    sx={{
                                        backgroundColor: row.isCurrentUser ? 'rgba(255, 216, 77, 0.15)' : 'inherit',
                                        '&:hover': { backgroundColor: themeMode === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)' },
                                        transition: 'background-color 0.2s'
                                    }}
                                >
                                    <TableCell>
                                        <Stack direction="row" alignItems="center" spacing={1}>
                                            <Typography variant="body1" fontWeight={row.rank <= 3 ? 800 : 500}>
                                                #{row.rank}
                                            </Typography>
                                            {getRankIcon(row.rank)}
                                        </Stack>
                                    </TableCell>
                                    <TableCell>
                                        <Stack direction="row" alignItems="center" spacing={2}>
                                            <Avatar src={row.avatarUrl} sx={{ width: 40, height: 40, border: row.rank <= 3 ? `2px solid ${row.rank === 1 ? '#FFD700' : row.rank === 2 ? '#C0C0C0' : '#CD7F32'}` : 'none' }} />
                                            <Typography variant="body1" fontWeight={row.isCurrentUser ? 700 : 500}>
                                                {row.username}
                                                {row.isCurrentUser && (
                                                    <Typography component="span" variant="caption" sx={{ ml: 1, color: AccentColors.navigationActive, fontWeight: 800 }}>
                                                        (YOU)
                                                    </Typography>
                                                )}
                                            </Typography>
                                        </Stack>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography variant="body1" fontWeight={700} color="primary">
                                            {row.reputation.toLocaleString()}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.5}>
                                            <Typography variant="body1" fontWeight={600}>
                                                {row.badgeCount}
                                            </Typography>
                                            <BadgeIcon sx={{ fontSize: 18, color: AccentColors.navigationActive }} />
                                        </Stack>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Tooltip title={row.prevRank ? `Previous rank: #${row.prevRank}` : 'Same position'} arrow>
                                            <Box>{getTrendIcon(row.rank, row.prevRank)}</Box>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};
