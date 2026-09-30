document.addEventListener("DOMContentLoaded", async () => {
  const listDiv = document.getElementById("video-list");
  const statusDiv = document.getElementById("status");

  // Automatically detect and use the correct browser API (Chrome/Edge vs Firefox)
  const extAPI = typeof browser !== "undefined" ? browser : chrome;

  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];

  // 1. Check if on YouTube and clean the address bar URL
  if (
    tab.url.includes("youtube.com/watch") ||
    tab.url.includes("youtu.be/") ||
    tab.url.includes("youtube.com/shorts/")
  ) {
    listDiv.innerHTML = "";

    let cleanUrl = tab.url;
    // Extract the 11-character ID to strip away playlists and radio parameters
    const match = tab.url.match(
      /(?:youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    );

    if (match) {
      // If it is a Short, keep the /shorts/ format. Otherwise, use watch?v=
      if (tab.url.includes("/shorts/")) {
        cleanUrl = `https://www.youtube.com/shorts/${match[1]}`;
      } else {
        cleanUrl = `https://www.youtube.com/watch?v=${match[1]}`;
      }
    }

    createButton(cleanUrl, tab.title.replace(" - YouTube", ""), "yt");
    return;
  }

  const results = await browser.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      // 2. If it finds a hidden iframe, strip the messy parameters and return a clean link
      function extractYouTubeUrl(rawUrl) {
        if (!rawUrl) return null;
        const match = rawUrl.match(
          /(?:youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        );

        // This drops all the "?autoplay=1&origin=..." garbage and creates a clean link
        return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
      }

      function getFilenameFromUrl(url) {
        try {
          const pathname = new URL(url).pathname;
          let filename = pathname.split("/").pop();
          if (!filename) return "Direct Video File";
          return decodeURIComponent(filename);
        } catch (e) {
          return "Direct Video File";
        }
      }

      const items = [];

      document.querySelectorAll("iframe").forEach((iframe) => {
        const src = iframe.src || iframe.getAttribute("data-src") || "";
        const ytUrl = extractYouTubeUrl(src);

        if (ytUrl) {
          let vidName = iframe.title || iframe.getAttribute("aria-label");
          if (!vidName || vidName === "YouTube video player")
            vidName = "YouTube Embed";
          items.push({ url: ytUrl, type: "yt", name: vidName });
        }
      });

      document.querySelectorAll("video").forEach((video) => {
        const vidTitle = video.title || video.getAttribute("aria-label");

        if (video.src && !video.src.startsWith("blob:")) {
          const finalName = vidTitle || getFilenameFromUrl(video.src);
          items.push({ url: video.src, type: "direct", name: finalName });
        }
        video.querySelectorAll("source").forEach((source) => {
          if (source.src && !source.src.startsWith("blob:")) {
            const finalName = vidTitle || getFilenameFromUrl(source.src);
            items.push({ url: source.src, type: "direct", name: finalName });
          }
        });
      });

      const unique = [];
      const seen = new Set();
      for (const item of items) {
        if (!seen.has(item.url)) {
          seen.add(item.url);
          unique.push(item);
        }
      }
      return unique;
    },
  });

  const foundVideos = results[0]?.result || [];

  listDiv.innerHTML = "";
  if (foundVideos.length === 0) {
    listDiv.innerHTML =
      '<div style="color: #888; text-align: center; padding: 12px 0;">No downloadable links found.</div>';
    return;
  }

  foundVideos.forEach((v) => {
    createButton(v.url, v.name, v.type);
  });

  function createButton(url, name, type) {
    const btn = document.createElement("button");
    btn.className = `video-btn ${type}`;
    btn.textContent = name;
    btn.title = `${name}\n${url}`;

    btn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(url);
        statusDiv.textContent = "Link Copied! Paste into FDM (Ctrl+V)";
        statusDiv.style.color = "#4caf50";
      } catch (err) {
        statusDiv.textContent = "Failed to copy. Try again.";
        statusDiv.style.color = "#ff3333";
      }
    };

    listDiv.appendChild(btn);
  }
});
