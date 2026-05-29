import { FC } from 'react';
import { LOGO_URL } from '../../utils/constants';

export interface SeoHeadProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
}

// Client-side meta tags for the browser tab title and JavaScript-rendering crawlers
// (e.g. Googlebot). Non-JS social crawlers (Facebook/X/LinkedIn/Slack) are served
// server-rendered tags by the API instead - see OgController + the UI nginx routing.
//
// React 19 natively hoists <title>/<meta> rendered anywhere in the tree into <head>,
// so no extra library (previously react-helmet-async) is required.
export const SeoHead: FC<SeoHeadProps> = ({
  title,
  description,
  image,
  url,
  type = 'article',
}) => {
  const metaDescription = description || 'Stellar security portal - audits, reports, and vulnerabilities.';
  const metaUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const metaImage = image || LOGO_URL;

  return (
    <>
      <title>{`${title} | Stellar Security Portal`}</title>
      <meta name="description" content={metaDescription} />

      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={metaImage} />
      <meta property="og:url" content={metaUrl} />
      <meta property="og:site_name" content="Stellar Security Portal" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={metaImage} />
    </>
  );
};
