import { FC } from 'react';
import { Helmet } from 'react-helmet-async';
import { LOGO_URL } from '../../utils/constants';

export interface SeoHeadProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
}

export const SeoHead: FC<SeoHeadProps> = ({
  title,
  description,
  image,
  url,
  type = 'website',
}) => {
  const metaDescription = description || 'Soroban security portal - audits, reports, and vulnerabilities.';
  const metaUrl = url || window.location.href;
  // Fallback image could be a generic logo if not provided
  const metaImage = image || LOGO_URL;

  return (
    <Helmet>
      {/* Standard Metadata */}
      <title>{title} | Soroban Security Portal</title>
      <meta name="description" content={metaDescription} />

      {/* Open Graph Metadata */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={metaImage} />
      <meta property="og:url" content={metaUrl} />
      <meta property="og:site_name" content="Soroban Security Portal" />

      {/* Twitter Cards Metadata */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={metaImage} />
    </Helmet>
  );
};
