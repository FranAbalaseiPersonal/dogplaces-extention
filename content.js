// ==== 1. CONFIG: we will fill these in later ====
const SUPABASE_URL = "PUT-YOUR-URL-HERE";
const SUPABASE_ANON_KEY = "PUT-YOUR-ANON-KEY-HERE";
const TEST_GOOGLE_PLACE_ID = "PUT-ONE-GOOGLE-PLACE-ID-HERE";

// ==== 2. Helper: create or update a floating badge ====
function getOrCreateBadge() {
  let badge = document.getElementById("dogplaces-badge");
  if (!badge) {
    badge = document.createElement("div");
    badge.id = "dogplaces-badge";
    badge.style.position = "fixed";
    badge.style.bottom = "20px";
    badge.style.right = "20px";
    badge.style.zIndex = "999999";
    badge.style.padding = "10px 16px";
    badge.style.borderRadius = "999px";
    badge.style.background = "white";
    badge.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
    badge.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    badge.style.fontSize = "13px";
    badge.style.display = "flex";
    badge.style.alignItems = "center";
    badge.style.gap = "6px";
    document.body.appendChild(badge);
  }
  return badge;
}

function setBadge(text, emoji) {
  const badge = getOrCreateBadge();
  badge.textContent = "";
  const icon = document.createElement("span");
  icon.textContent = emoji;
  const txt = document.createElement("span");
  txt.textContent = text;
  badge.appendChild(icon);
  badge.appendChild(txt);
}

// ==== 3. Fetch place status from Supabase ====
async function fetchPlaceByGoogleId(googlePlaceId) {
  const url = `${SUPABASE_URL}/rest/v1/places?google_place_id=eq.${googlePlaceId}&select=*`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  const data = await res.json();
  return data[0] || null;
}

// ==== 4. Show badge based on dog status ====
function showStatus(place) {
  if (!place) {
    setBadge("Not in DogPlaces yet", "❓");
    return;
  }

  if (place.dog_status === "dog_friendly") {
    setBadge("Dog-friendly", "✅");
  } else if (place.dog_status === "no_dogs") {
    setBadge("No dogs", "🚫");
  } else {
    setBadge("Unknown", "❓");
  }
}

// ==== 5. Main: test with a hardcoded Google Place ID ====
async function initDogPlaces() {
  setBadge("Checking dog status…", "⏳");
  const place = await fetchPlaceByGoogleId(TEST_GOOGLE_PLACE_ID);
  showStatus(place);
}

// Run once the page loads
window.addEventListener("load", () => {
  setTimeout(initDogPlaces, 2000);
});
