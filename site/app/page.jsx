import { post } from '../content/registry';
import { PostView } from 'storydeck';

// The storydeck landing IS a storydeck post — the library telling its own story via Read/Scroll/Watch.
export default function Home() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'storydeck',
    applicationCategory: 'DeveloperApplication',
    description: post.description,
    url: 'https://footprintjs.github.io/storydeck/',
    author: { '@type': 'Person', name: post.author, url: 'https://github.com/sanjay1909' },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <style dangerouslySetInnerHTML={{ __html: post.deckCssScoped }} />
      <PostView post={post} />
    </>
  );
}
