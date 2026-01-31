import React from 'react';
import { Stack, IconButton, Tooltip } from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import TwitterIcon from '@mui/icons-material/X';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import LanguageIcon from '@mui/icons-material/Language';
import ChatIcon from '@mui/icons-material/Chat';
import { SocialLinks as SocialLinksType } from '../../../../../api/soroban-security-portal/models/user';

interface SocialLinksProps {
  links: SocialLinksType;
}

export const SocialLinks: React.FC<SocialLinksProps> = ({ links }) => {
  if (!links) return null;

  const socialIcons = [
    { key: 'github', icon: <GitHubIcon />, label: 'GitHub', url: links.github },
    { key: 'twitter', icon: <TwitterIcon />, label: 'X (Twitter)', url: links.twitter },
    { key: 'linkedin', icon: <LinkedInIcon />, label: 'LinkedIn', url: links.linkedin },
    { key: 'discord', icon: <ChatIcon />, label: 'Discord', url: links.discord },
    { key: 'website', icon: <LanguageIcon />, label: 'Website', url: links.website },
  ].filter(item => item.url);

  if (socialIcons.length === 0) return null;

  return (
    <Stack direction="row" spacing={1}>
      {socialIcons.map((social) => (
        <Tooltip key={social.key} title={social.label} arrow>
          <IconButton
            component="a"
            href={social.url}
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            sx={{
              color: 'text.secondary',
              '&:hover': {
                color: 'primary.main',
                backgroundColor: 'action.hover',
              }
            }}
          >
            {social.icon}
          </IconButton>
        </Tooltip>
      ))}
    </Stack>
  );
};
