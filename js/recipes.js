function loadRecipes(jsonPath = "/data/baking.json") {
  fetch(jsonPath)
    .then(response => response.json())
    .then(data => renderRecipeTable(data))
    .catch(error => console.error("Error loading recipes:", error));
}

function normalizeName(name) {
  return name.toLowerCase().replace(/ x\d+$/, "").trim();
}

function findSubcombine(name, recipes) {
  const norm = normalizeName(name);
  return recipes.find(r => normalizeName(r.result) === norm);
}

function createComponentLink(name) {
  const link = document.createElement("a");
  link.href = `https://everquest.allakhazam.com/search.html?q=${encodeURIComponent(name)}`;
  link.textContent = name;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function buildComponentTree(components, recipes, seen = new Set(), depth = 0) {
  const container = document.createElement("div");
  container.className = "component-block";

  components.forEach(comp => {
    const compKey = normalizeName(comp);
    const sub = findSubcombine(comp, recipes);

    if (sub && !seen.has(compKey)) {
      const toggle = document.createElement("span");
      toggle.className = "sub-toggle";
      toggle.textContent = `▶ ${comp}`;

      const subID = `sub_${crypto.randomUUID()}`;
      const subList = document.createElement("div");
      subList.id = subID;
      subList.className = "sub-list";
      subList.style.display = "none";

      const newSeen = new Set(seen);
      newSeen.add(compKey);
      const nested = buildComponentTree(sub.components || [], recipes, newSeen, depth + 1);
      subList.appendChild(nested);

      toggle.addEventListener("click", () => {
        const isOpen = subList.style.display === "block";
        subList.style.display = isOpen ? "none" : "block";
        toggle.textContent = `${isOpen ? "▶" : "▼"} ${comp}`;
      });

      const block = document.createElement("div");
      block.className = "subcombine";
      block.style.marginLeft = `${depth * 1.5}em`;

      block.appendChild(toggle);
      block.appendChild(subList);
      container.appendChild(block);
    } else {
      const span = document.createElement("span");
      span.className = "component-inline";
      span.style.marginLeft = `${depth * 1.5}em`;
      span.appendChild(createComponentLink(comp));
      container.appendChild(span);
    }
  });

  return container;
}

function renderRecipeTable(recipes) {
  const container = document.getElementById("recipe-table");
  if (!container) return;
  container.innerHTML = "";

  const materialFilter = document.getElementById("filter-material")?.value.toLowerCase().trim() || "";
  const tagFilters = Array.from(document.querySelectorAll("input[name='tag-filter']:checked")).map(e => e.value.trim().toLowerCase());
  const mealFilters = Array.from(document.querySelectorAll("input[name='meal-filter']:checked")).map(e => e.value.trim().toLowerCase());
  const expansionFilters = Array.from(document.querySelectorAll("input[name='expansion-filter']:checked")).map(e => e.value.trim().toLowerCase());
  const statPriority = getStatPriority();

  const filtered = recipes
    .filter(recipe => {
      const materials = (recipe.components || []).map(mat => mat.toLowerCase().trim());
      const matchesMaterial =
        materialFilter === "" ||
        materials.some(mat => mat.includes(materialFilter));

      const recipeTags = (recipe.tags || []).map(tag => tag.trim().toLowerCase());
      const matchesTags =
        tagFilters.length === 0 ||
        tagFilters.every(tag => recipeTags.includes(tag));

      const recipeMeal = (recipe.mealSize || "").trim().toLowerCase();
      const matchesMeals =
        mealFilters.length === 0 || mealFilters.includes(recipeMeal);

      const recipeExpansion = (recipe.expansion || "").trim().toLowerCase();
      const matchesExpansion =
        expansionFilters.length === 0 || expansionFilters.includes(recipeExpansion);

      return matchesMaterial && matchesTags && matchesMeals && matchesExpansion;
    })
    .sort((a, b) => {
      const aHasPriority = statPriority.some(stat => (a.stats || []).join(" ").toLowerCase().includes(stat));
      const bHasPriority = statPriority.some(stat => (b.stats || []).join(" ").toLowerCase().includes(stat));
      if (aHasPriority && !bHasPriority) return -1;
      if (!aHasPriority && bHasPriority) return 1;
      return a.trivial - b.trivial;
    });

  const table = document.createElement("table");
  table.className = "recipe-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Name</th>
        <th>Trivial</th>
        <th>Yield</th>
        <th>Meal Size</th>
        <th class="hover-expand">Stats</th>
        <th class="hover-expand">Components</th>
        <th>Expansion</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");

  for (const recipe of filtered) {
    const stats = (recipe.stats && Object.entries(recipe.stats).map(([k, v]) => `${k} +${v}`).join(", ")) || "—";
    const yieldVal = recipe.yield ?? 1;
    const mealSize = recipe.mealSize ?? "—";
    const expansion = recipe.expansion || "—";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${recipe.name}</td>
      <td>${recipe.trivial}</td>
      <td>${yieldVal}</td>
      <td>${getMealIcon(mealSize)} ${mealSize}</td>
      <td class="hover-expand" data-full="${stats}">${truncate(stats)}</td>
      <td class="hover-expand"></td>
      <td>${expansion}</td>
    `;

    const tdComponents = tr.children[5];
    tdComponents.appendChild(buildComponentTree(recipe.components || [], recipes));
    tbody.appendChild(tr);
  }

  container.appendChild(table);
  enableMobileExpand();
}

function enableMobileExpand() {
  const isMobile = window.matchMedia("(hover: none)").matches;
  if (!isMobile) return;

  document.querySelectorAll(".hover-expand").forEach(cell => {
    cell.addEventListener("click", () => {
      const full = cell.getAttribute("data-full");
      const current = cell.textContent;
      if (full) {
        cell.textContent = current === full ? truncate(full) : full;
      }
    });
  });
}

function getMealIcon(size) {
  switch ((size || "").trim().toLowerCase()) {
    case "snack": return "🍪";
    case "meal": return "🥣";
    case "hearty meal": return "🍛";
    case "banquet": return "🥘";
    case "feast": return "🍗";
    case "enduring meal": return "🧆";
    case "miraculous meal": return "✨🍽️";
    default: return "❔";
  }
}
  

function getStatPriority() {
  return Array.from(document.querySelectorAll("input[name='stat-priority']:checked"))
    .map(e => e.value.toLowerCase());
}

function truncate(text, limit = 40) {
  return text.length > limit ? text.slice(0, limit) + "…" : text;
}
