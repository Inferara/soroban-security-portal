import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { UserItem, Badge, SocialLinks } from '../../../../../api/soroban-security-portal/models/user';
import { useAuth } from 'react-oidc-context';

// Mock data for demonstration
const createMockUser = (id: number): UserItem => {
  const user = new UserItem();
  user.loginId = id;
  user.fullName = id === 1 ? 'Alice Johnson' : id === 2 ? 'Bob Smith' : 'Charlie Davis';
  user.email = `user${id}@example.com`;
  user.bio = id === 1 
    ? 'Smart contract security researcher with 5+ years of experience in blockchain auditing. Passionate about making Web3 safer for everyone.'
    : id === 2
    ? 'Full-stack developer specializing in Soroban smart contracts and DeFi protocols.'
    : 'Security enthusiast and bug bounty hunter. Always looking for vulnerabilities.';
  user.expertiseTags = id === 1
    ? ['Smart Contracts', 'Security Auditing', 'Soroban', 'Rust', 'DeFi']
    : id === 2
    ? ['Soroban', 'TypeScript', 'React', 'Web3']
    : ['Bug Bounty', 'Penetration Testing', 'Security Research'];
  
  const socialLinks = new SocialLinks();
  socialLinks.github = `https://github.com/user${id}`;
  socialLinks.twitter = `https://twitter.com/user${id}`;
  socialLinks.linkedin = `https://linkedin.com/in/user${id}`;
  socialLinks.website = id === 1 ? 'https://alicejohnson.dev' : undefined;
  user.socialLinks = socialLinks;
  
  user.reputationScore = id === 1 ? 9850 : id === 2 ? 7200 : 5400;
  user.followersCount = id === 1 ? 342 : id === 2 ? 156 : 89;
  user.followingCount = id === 1 ? 128 : id === 2 ? 203 : 145;
  user.isPublic = id !== 3; // User 3 is private
  user.created = new Date(2023, id, 15);
  user.role = id === 1 ? 'Expert Auditor' : 'Security Researcher';
  user.personalInfo = id === 1 
    ? '## About Me\n\nI specialize in smart contract security and have audited over 50 protocols.\n\n### Achievements\n- Found critical vulnerabilities in major DeFi protocols\n- Published research on Soroban security best practices'
    : '';
  
  // Badges
  const badges: Badge[] = [];
  if (id === 1) {
    badges.push({
      id: 'top-contributor',
      name: 'Top Contributor',
      icon: '🏆',
      description: 'Top 10 contributor',
      color: '#FFD700'
    });
    badges.push({
      id: 'security-expert',
      name: 'Security Expert',
      icon: '🛡️',
      description: 'Verified security expert',
      color: '#4CAF50'
    });
  }
  if (id === 2) {
    badges.push({
      id: 'early-adopter',
      name: 'Early Adopter',
      icon: '⭐',
      description: 'Early platform member',
      color: '#2196F3'
    });
  }
  user.badges = badges;
  
  return user;
};

// Mock activity data
export interface Activity {
  id: number;
  type: 'report' | 'comment' | 'vulnerability' | 'follow';
  title: string;
  description: string;
  timestamp: Date;
  link?: string;
}

const createMockActivity = (userId: number): Activity[] => {
  return [
    {
      id: 1,
      type: 'report',
      title: 'Submitted security report for Protocol XYZ',
      description: 'Found critical reentrancy vulnerability',
      timestamp: new Date(2026, 0, 20),
      link: '/report/123'
    },
    {
      id: 2,
      type: 'comment',
      title: 'Commented on vulnerability #456',
      description: 'Provided additional context on the exploit scenario',
      timestamp: new Date(2026, 0, 18),
      link: '/vulnerability/456'
    },
    {
      id: 3,
      type: 'vulnerability',
      title: 'Reported new vulnerability: Integer Overflow in Token Contract',
      description: 'Discovered integer overflow in token minting function',
      timestamp: new Date(2026, 0, 15),
      link: '/vulnerability/789'
    }
  ];
};

export const useUserProfile = () => {
  const { id } = useParams<{ id: string }>();
  const auth = useAuth();
  const [user, setUser] = useState<UserItem | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const userId = parseInt(id || '0');
  const isOwnProfile = auth.user?.profile?.sub === userId.toString();

  useEffect(() => {
    // Simulate API call
    setLoading(true);
    setTimeout(() => {
      const mockUser = createMockUser(userId);
      setUser(mockUser);
      setActivity(createMockActivity(userId));
      setIsFollowing(mockUser.isFollowing || false);
      setLoading(false);
    }, 500);
  }, [userId]);

  const handleFollow = async () => {
    setFollowLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsFollowing(!isFollowing);
      if (user) {
        setUser({
          ...user,
          followersCount: (user.followersCount || 0) + (isFollowing ? -1 : 1)
        });
      }
      setFollowLoading(false);
    }, 500);
  };

  return {
    user,
    activity,
    loading,
    isFollowing,
    followLoading,
    handleFollow,
    isOwnProfile
  };
};
