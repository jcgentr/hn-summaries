import { JSDOM } from "jsdom";

export const dynamic = "force-dynamic";

export const maxDuration = 60;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const page = Number((await searchParams).p) || 1;
  const response = await fetch(
    `https://news.ycombinator.com/${page > 1 ? `?p=${page}` : ""}`,
    {
      cache: "no-store",
    }
  );
  const html = await response.text();

  // Create a new JSDOM instance with the fetched HTML
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // Fix all relative URLs to absolute ones
  const links = document.querySelectorAll("a[href]");
  links.forEach((link) => {
    const href = link.getAttribute("href");

    if (href?.includes("mailto:") || link.classList.contains("morelink")) {
      return;
    }

    if (href?.startsWith("/") || !href?.includes("://")) {
      link.setAttribute(
        "href",
        `https://news.ycombinator.com/${href?.replace(/^\//, "")}`
      );
    }
  });

  // Fix image sources
  const images = document.querySelectorAll("img[src]");
  images.forEach((img) => {
    const src = img.getAttribute("src");
    if (src && !src.includes("://")) {
      img.setAttribute(
        "src",
        `https://news.ycombinator.com/${src.replace(/^\//, "")}`
      );
    }
  });

  // Fix CSS links
  const styleLinks = document.querySelectorAll('link[rel="stylesheet"]');
  styleLinks.forEach((link) => {
    const href = link.getAttribute("href");
    if (href && !href.includes("://")) {
      link.setAttribute(
        "href",
        `https://news.ycombinator.com/${href.replace(/^\//, "")}`
      );
    }
  });

  const storyRows = document.querySelectorAll("tr.athing");
  storyRows.forEach((row) => {
    const titleCell = row.querySelector("td.title:last-child");
    if (titleCell) {
      const summaryButton = document.createElement("button");
      summaryButton.textContent = "Summarize";
      summaryButton.className = "summarize-btn";
      summaryButton.style.cssText = `
        margin-left: 8px;
        font-size: 10px;
        padding: 1px 4px;
        background: #f6f6ef;
        border: 1px solid #828282;
        border-radius: 3px;
        cursor: pointer;
      `;
      titleCell.appendChild(summaryButton);
    }
  });

  // Add the button hover style to the head
  const style = document.createElement("style");
  style.textContent = `
    .summarize-btn {
      margin-left: 8px;
      font-size: 10px;
      padding: 1px 4px;
      background: #f6f6ef;
      border: 1px solid #828282;
      border-radius: 3px;
      cursor: pointer;
    }
    .summarize-btn:hover {
      background: #ff6600 !important;
      color: white !important;
    }
    .summarize-btn[disabled],
    .summarize-btn:disabled {
      opacity: 0.5 !important;
      cursor: not-allowed !important;
      background: #f6f6ef !important;
      color: #828282 !important;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(style);

  // Add script for handling button clicks (client side)
  const script = document.createElement("script");
  script.textContent = `
    document.addEventListener('click', async function(e) {
      if (e.target.classList.contains('summarize-btn')) {
        const button = e.target;
        const storyRow = button.closest('tr.athing');
        const titleLink = storyRow.querySelector('td.title > span.titleline > a');
        const storyUrl = titleLink.getAttribute('href');
        
        // Check if summary already exists
        const existingSummary = storyRow.querySelector('.summary-div');
        if (existingSummary) {
          // Toggle visibility
          existingSummary.style.display = existingSummary.style.display === 'none' ? 'block' : 'none';
          button.textContent = existingSummary.style.display === 'none' ? 'Show Summary' : 'Hide Summary';
          return;
        }

        button.disabled = true;
        button.textContent = 'Summarizing...';
        
        try {
          // Check localStorage first
          const cachedItem = localStorage.getItem(\`summary_\${storyUrl}\`);
          let data;
          
          if (cachedItem) {
            try {
              const cached = JSON.parse(cachedItem);
              
              // Handle migration from old cache format
              if (!cached.timestamp) {
                // Old format was just the data object directly
                const cacheData = {
                  data: cached,
                  timestamp: Date.now(), // Give it a fresh timestamp
                  isError: !!cached.error
                };
                localStorage.setItem(\`summary_\${storyUrl}\`, JSON.stringify(cacheData));
                data = cached;
              } else {
                // New format
                const now = Date.now();
                const ttl = cached.isError ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
                
                if (now - cached.timestamp < ttl) {
                  data = cached.data;
                  console.log(\`Using cached \${cached.isError ? 'error' : 'summary'}\`);
                } else {
                  localStorage.removeItem(\`summary_\${storyUrl}\`);
                }
              }
            } catch (e) {
              // If there's any parsing error, remove the invalid cache
              console.log('Removing invalid cache entry');
              localStorage.removeItem(\`summary_\${storyUrl}\`);
            }
          }

          if (!data) {
            // If not in cache or expired, fetch from API
            const response = await fetch('/api/articles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: storyUrl })
            });
            
            data = await response.json();
            
            // Cache the result
            const cacheData = {
              data,
              timestamp: Date.now(),
              isError: !!data?.error
            };
            
            localStorage.setItem(\`summary_\${storyUrl}\`, JSON.stringify(cacheData));
            console.log(\`Cached \${data?.error ? 'error' : 'summary'}\`);
          }

          if (data?.error) {
            throw new Error(data.error);
          }
          
          // Format tags with spaces after commas
          const formattedTags = data.tags.split(',').map(tag => tag.trim()).join(', ');
          // Calculate read time (assuming average reading speed of 238 words per minute)
          const readTimeMinutes = Math.ceil(data.word_count / 238);
          
          const summaryDiv = document.createElement('div');
          summaryDiv.className = 'summary-div';
          summaryDiv.style.cssText = 'padding: 8px; margin-top: 4px; margin-right: 8px; background: #f6f6ef; border: 1px solid #ddd; border-radius: 4px;';
          summaryDiv.innerHTML = \`
            <div><strong>Summary:</strong> \${data.summary}</div>
            <div><strong>Word Count:</strong> \${data.word_count?.toLocaleString() || '🤷'}</div>
            <div><strong>Read Time:</strong> \${readTimeMinutes} min read</div>
            <div><strong>Author:</strong> \${data.author || '🤷'}</div>
            <div><strong>Published:</strong> \${data.published_time ? new Date(data.published_time).toLocaleDateString() : '🤷'}</div>
            <div><strong>Tags:</strong> \${formattedTags}</div>
          \`;
          
          // Insert after the summary button
          button.insertAdjacentElement('afterend', summaryDiv);
          
          button.textContent = 'Hide Summary';
          button.disabled = false;
        } catch (error) {
          console.error('Failed to get summary:', error);
          button.textContent = 'Error';
          button.disabled = false;
        }
      }
    });
  `;
  document.body.appendChild(script);

  // Buy Me a Coffee button
  const coffeeDiv = document.createElement("div");
  coffeeDiv.style.cssText = `
     position: fixed;
     bottom: 20px;
     left: 20px;
     padding: 8px 12px;
     background: #fff;
     border: 1px solid #ffdd00;
     border-radius: 6px;
     box-shadow: 0 2px 4px rgba(0,0,0,0.1);
     font-size: 12px;
     z-index: 1000;
   `;

  coffeeDiv.innerHTML = `
     <a href="https://buymeacoffee.com/spicy_ranch" target="_blank" rel="noopener" style="
       color: #000000;
       text-decoration: none;
       display: flex;
       align-items: center;
       gap: 4px;
     ">
       <span>☕️</span>
       <span>Buy me a coffee</span>
     </a>
   `;

  document.body.appendChild(coffeeDiv);

  // Gistr sponsor
  const sponsorDiv = document.createElement("div");
  sponsorDiv.style.cssText = `
   position: fixed;
   bottom: 20px;
   right: 20px;
   padding: 8px 12px;
   background: #fff;
   border: 1px solid #ff6600;
   border-radius: 6px;
   box-shadow: 0 2px 4px rgba(0,0,0,0.1);
   font-size: 12px;
   z-index: 1000;
 `;

  sponsorDiv.innerHTML = `
   <a href="https://www.getgistr.com" target="_blank" rel="noopener" style="
     color: #ff6600;
     text-decoration: none;
   ">
     <span>Powered by </span>
     <strong>Gistr </strong>
     <span style="
       font-size: 10px;
       background: #ff6600;
       color: white;
       padding: 2px 4px;
       border-radius: 3px;
     ">AI Summaries</span>
   </a>
 `;

  document.body.appendChild(sponsorDiv);

  return (
    <div
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: dom.serialize() }}
    />
  );
}
