let activeLikes = [];
let updateQueue = [];

// Fetches the like status for a game.
async function getLike(universeId) {
  const response = await fetch(
    `https://games.roblox.com/v1/games/${universeId}/votes/user`,
    {
      credentials: "include",
      headers: {
        Cookie: document.cookie,
      },
    },
  );

  const data = await response.json();
  return data;
}

// Updates the UI for a game card with the given like.
function updateUi(link, like) {
  if (like === null) {
    return;
  }
  const likeIcon = link.querySelector(".game-card-name");

  likeIcon.style.color = like ? "green" : "red";
}

// Updates the UI for a game card via the API.
async function updateCard(link, universeId) {
  const likes = await getLike(universeId);

  updateUi(link, likes.userVote);
  browser.storage.local.set({ [`like-${universeId}`]: likes.userVote });
}

// Extracts the universeId from a game link.
function getLinkUniverseId(linkElement) {
  const href = linkElement.getAttribute("href");
  const params = new URL(href);
  return params.searchParams.get("universeId");
}

// Finds all game links on the page and adds them to the queue for querying likes.
async function queryLinks() {
  let links = Array.from(document.querySelectorAll(".game-card-link"))
    .map((link) => ({
      element: link,
      universeId: getLinkUniverseId(link),
    }))
    .filter((link) => !activeLikes.includes(link.universeId));

  const cachedLikes = await browser.storage.local.get(
    links.map((link) => `like-${link.universeId}`),
  );

  for (const link of links) {
    const cachedLike = cachedLikes?.[`like-${link.universeId}`];
    if (typeof cachedLike !== "undefined") {
      updateUi(link.element, cachedLike);
    }

    activeLikes.push(link.universeId);
  }

  updateQueue = [
    ...updateQueue,
    ...links.filter(
      (link) =>
        !updateQueue.some(
          (queueLink) => queueLink.universeId === link.universeId,
        ),
    ),
  ];
}

async function start() {
  const manifest = browser.runtime.getManifest();
  console.log(`Starting ${manifest.name} v${manifest.version}`);

  const version = (await browser.storage.local.get("version"))?.version;
  if (version !== manifest.version) {
    console.log("Updated to new version, clearing cache.");
    await browser.storage.local.clear();
    await browser.storage.local.set({ version: manifest.version });
  }

  // Find all links and add them to the queue for querying likes.
  setInterval(async () => {
    await queryLinks();
  }, 2000);

  // Take an item off the queue and update it.
  setInterval(() => {
    if (updateQueue.length === 0) {
      return;
    }

    const link = updateQueue.shift();
    updateCard(link.element, link.universeId);
  }, 1000);

  setTimeout(() => {
    // Get current game metadata (if on game details page).
    const currentGameMetadata = document.getElementById(
      "game-detail-meta-data",
    )?.dataset;

    if (currentGameMetadata) {
      // Find all like/dislike buttons and remove game's like cache on click.
      const likeButtons = document.querySelectorAll(".upvote, .downvote");
      likeButtons.forEach((button) => {
        button.addEventListener("click", async () => {
          browser.storage.local.remove(
            `like-${currentGameMetadata.universeId}`,
          );
        });
      });
    }
  }, 1000);
}

start();
