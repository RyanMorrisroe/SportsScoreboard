<template>
  <div class="p-4 md:p-6">
    <div
      v-if="update && !updateNoticeDismissed"
      class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4"
      role="status"
      aria-live="polite"
    >
      <div class="min-w-0 flex-1">
        <p class="text-sm font-bold text-amber-100">Version {{ update.version }} is available.</p>
        <p v-if="update.notes" class="mt-1 line-clamp-2 whitespace-pre-line text-xs text-amber-100/80">
          {{ update.notes }}
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <button
          type="button"
          @click="openUpdateDownload"
          class="rounded-md bg-amber-400 px-3 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-300"
        >
          Download
        </button>
        <button
          type="button"
          @click="dismissUpdateNotice"
          aria-label="Dismiss update notice"
          class="rounded-md px-2 py-2 text-sm text-amber-100 hover:bg-amber-500/20"
        >
          ×
        </button>
      </div>
    </div>

    <!-- SPORT TABS -->
    <div class="flex items-center gap-2 mb-6">
      <div
        class="flex min-w-0 flex-1 items-center overflow-x-auto border-b border-zinc-800 rounded-xl bg-zinc-900/50 p-1 max-w-md"
        role="tablist"
        aria-label="Sports"
      >
      <button
        v-for="league in visibleLeagues"
        :key="league.id"
        type="button"
        role="tab"
        :aria-selected="selectedLeague === league.id"
        @click="switchTab(league.id)"
        :class="
          selectedLeague === league.id
            ? 'bg-blue-600 text-white shadow-md'
            : 'text-zinc-400 hover:text-zinc-200'
        "
        class="flex-1 whitespace-nowrap text-center py-2.5 px-3 rounded-lg text-sm font-bold tracking-wide transition-all duration-150"
      >
        {{ league.label }}
      </button>
      </div>
      <button
        type="button"
        @click="openSettings"
        :aria-expanded="settingsOpen"
        aria-haspopup="dialog"
        class="shrink-0 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs font-bold text-zinc-300 hover:text-white"
      >
        Settings
      </button>
    </div>

    <div
      v-if="settingsOpen"
      class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      @click.self="closeSettings"
      @keydown.esc.window="closeSettings"
    >
      <div
        class="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl"
      >
        <header class="flex items-center justify-between border-b border-zinc-800 px-4 py-3 sm:px-5">
          <h2 id="settings-title" class="text-base font-black text-white">Settings</h2>
          <button
            type="button"
            @click="closeSettings"
            class="rounded-lg px-3 py-2 text-xs font-bold text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            Close
          </button>
        </header>

        <div class="space-y-6 overflow-y-auto p-4 sm:p-5">
          <section aria-labelledby="sports-settings-title">
            <h3 id="sports-settings-title" class="mb-3 text-sm font-black text-white">Sports</h3>
            <div class="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
              <div
                v-for="(league, index) in orderedLeagues"
                :key="league.id"
                class="flex items-center gap-3 px-3 py-2.5"
              >
                <label class="flex min-w-0 flex-1 items-center gap-3 text-sm font-semibold text-zinc-200">
                  <input
                    type="checkbox"
                    :checked="preferences.visibleLeagues.includes(league.id)"
                    :disabled="preferences.visibleLeagues.length === 1 && preferences.visibleLeagues[0] === league.id"
                    @change="setLeagueVisibility(league.id, ($event.target as HTMLInputElement).checked)"
                    class="h-4 w-4 accent-blue-500"
                  />
                  <span class="truncate">{{ league.name }}</span>
                </label>
                <button
                  type="button"
                  :disabled="index === 0"
                  :aria-label="`Move ${league.name} up`"
                  title="Move up"
                  @click="moveLeagueInOrder(league.id, -1)"
                  class="rounded-md px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  :disabled="index === orderedLeagues.length - 1"
                  :aria-label="`Move ${league.name} down`"
                  title="Move down"
                  @click="moveLeagueInOrder(league.id, 1)"
                  class="rounded-md px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
            </div>
          </section>

          <section
            v-if="isNativeApp"
            aria-labelledby="updates-settings-title"
            class="border-t border-zinc-800 pt-5"
          >
            <h3 id="updates-settings-title" class="mb-3 text-sm font-black text-white">Updates</h3>
            <label class="flex items-center gap-3 text-sm font-semibold text-zinc-200">
              <input
                type="checkbox"
                :checked="preferences.autoCheckForUpdates"
                @change="setAutoCheckForUpdates(($event.target as HTMLInputElement).checked)"
                class="h-4 w-4 accent-amber-500"
              />
              <span>Automatically check for updates on launch</span>
            </label>
            <div class="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                :disabled="updateChecking"
                @click="checkForUpdates()"
                class="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-bold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                {{ updateChecking ? 'Checking...' : 'Check for updates' }}
              </button>
              <button
                v-if="update"
                type="button"
                @click="openUpdateDownload"
                class="rounded-md bg-amber-400 px-3 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-300"
              >
                Download {{ update.version }}
              </button>
            </div>
            <p class="mt-3 text-xs text-zinc-400" role="status" aria-live="polite">
              {{ updateError || (update ? `Version ${update.version} is available.` : updateChecked ? 'No update is available.' : preferences.autoCheckForUpdates ? 'Automatic checks are enabled.' : 'Automatic checks are off. You can check manually.') }}
            </p>
            <div v-if="update?.notes" class="mt-3 max-h-40 overflow-y-auto whitespace-pre-line rounded-md border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-300">
              {{ update.notes }}
            </div>
          </section>

          <section aria-labelledby="favorite-teams-title" class="border-t border-zinc-800 pt-5">
            <h3 id="favorite-teams-title" class="mb-3 text-sm font-black text-white">Favorite teams</h3>
            <label class="mb-3 block text-xs font-semibold text-zinc-400">
              Sport
              <span class="relative mt-1.5 block">
                <select
                  v-model="favoriteLeague"
                  @change="handleFavoriteLeagueChange"
                  class="block w-full appearance-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 pr-10 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option v-for="league in LEAGUES" :key="league.id" :value="league.id">
                    {{ league.name }}
                  </option>
                </select>
                <span
                  aria-hidden="true"
                  class="pointer-events-none absolute right-5 top-1/2 h-2 w-2 -translate-y-3/4 rotate-45 border-b-2 border-r-2 border-zinc-300"
                ></span>
              </span>
            </label>

            <div class="mb-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div class="mb-2 flex items-center justify-between gap-3">
                <span class="text-xs font-bold uppercase tracking-wide text-zinc-400">Selected</span>
                <span class="font-mono text-xs text-zinc-500">{{ selectedFavoriteTeams.length }}</span>
              </div>
              <div v-if="selectedFavoriteTeams.length" class="flex flex-wrap gap-2">
                <div
                  v-for="team in selectedFavoriteTeams"
                  :key="team.id"
                  class="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 py-1 pl-2 pr-1 text-xs text-amber-200"
                >
                  <img v-if="team.logo" :src="team.logo" :alt="`${team.name} logo`" class="h-5 w-5 object-contain" />
                  <span>{{ team.name }}</span>
                  <button
                    type="button"
                    :aria-label="`Remove ${team.name} from favorites`"
                    @click="toggleFavorite(team)"
                    class="rounded px-1.5 py-1 text-amber-100 hover:bg-amber-500/20"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <p v-else class="text-xs text-zinc-500">No favorite teams selected.</p>
            </div>

            <label class="mb-2 block text-xs font-semibold text-zinc-400">
              Find a team
              <input
                v-model="favoriteSearch"
                type="search"
                autocomplete="off"
                placeholder="Search teams"
                class="mt-1.5 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <div v-if="teamOptionsLoading" class="flex items-center gap-3 py-5 text-sm text-zinc-400">
              <div class="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
              Loading teams...
            </div>
            <div v-else-if="teamOptionsError" class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-900/60 bg-red-950/20 p-3 text-sm text-red-300">
              <span>{{ teamOptionsError }}</span>
              <button
                type="button"
                @click="loadFavoriteTeamOptions(favoriteLeague, true)"
                class="rounded-md border border-red-800 px-3 py-1.5 text-xs font-bold hover:bg-red-950"
              >
                Retry
              </button>
            </div>
            <div v-else-if="filteredTeamOptions.length" class="max-h-64 divide-y divide-zinc-800 overflow-y-auto rounded-xl border border-zinc-800">
              <label
                v-for="team in filteredTeamOptions"
                :key="team.id"
                class="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800/60"
              >
                <input
                  type="checkbox"
                  :checked="isFavoriteTeam(team.id)"
                  @change="toggleFavorite(team)"
                  class="h-4 w-4 accent-amber-500"
                />
                <img v-if="team.logo" :src="team.logo" :alt="`${team.name} logo`" class="h-6 w-6 shrink-0 object-contain" loading="lazy" />
                <span class="min-w-0 flex-1 truncate">{{ team.name }}</span>
                <span class="font-mono text-xs text-zinc-500">{{ team.abbreviation }}</span>
              </label>
            </div>
            <p v-else class="rounded-lg border border-dashed border-zinc-800 p-4 text-center text-sm text-zinc-500">
              {{ teamOptionsByLeague[favoriteLeague] ? 'No teams match this search.' : 'No team list loaded.' }}
            </p>
          </section>
        </div>
      </div>
    </div>

    <!-- DYNAMIC CONTROLS BAR (LEFT-ALIGNED, HEADERS REMOVED) -->
    <div
      class="flex flex-col md:flex-row md:items-center justify-start gap-4 border-b border-zinc-800 pb-5 mb-1"
    >
      <div class="flex flex-wrap items-center gap-3 justify-start w-full">
        <!-- CFB CONFERENCE DROPDOWN -->
        <span v-if="leagueBehavior?.schedule.supportsGroupFilter" class="relative inline-block">
          <select
            v-model="selectedGroup"
            @change="handleGroupChange"
            class="block min-w-[140px] appearance-none rounded-xl border border-zinc-800 bg-zinc-950 px-3 pr-9 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="80">All</option>
            <option value="">Top 25 Rankings</option>
            <option value="1">ACC</option>
            <option value="4">Big 12</option>
            <option value="5">Big Ten (B1G)</option>
            <option value="12">C-USA</option>
            <option value="18">Independent</option>
            <option value="15">MAC</option>
            <option value="17">Mountain West</option>
            <option value="9">PAC-12</option>
            <option value="8">SEC</option>
            <option value="37">Sun Belt</option>
          </select>
          <span
            aria-hidden="true"
            class="pointer-events-none absolute right-4 top-1/2 h-2 w-2 -translate-y-3/4 rotate-45 border-b-2 border-r-2 border-zinc-300"
          ></span>
        </span>

        <!-- FOOTBALL WEEK CHANGER CONTROLS -->
        <div
          v-if="leagueBehavior?.schedule.mode === 'week'"
          class="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-1 h-[38px]"
        >
          <button
            @click="adjustWeek(-1)"
            class="text-zinc-400 hover:text-white px-3 font-bold text-lg h-full"
          >
            -
          </button>
          <span
            class="text-sm px-2 text-white font-semibold min-w-[75px] text-center"
            >Week {{ week }}</span
          >
          <button
            @click="adjustWeek(1)"
            class="text-zinc-400 hover:text-white px-3 font-bold text-lg h-full"
          >
            +
          </button>
        </div>

        <!-- FOOTBALL SEASON TYPE SEGMENT CONTROLLER -->
        <div
          v-if="leagueBehavior?.schedule.mode === 'week'"
          class="flex bg-zinc-950 border border-zinc-800 p-1 rounded-xl h-[38px]"
        >
          <button
            @click="setSeasonType(2)"
            :class="
              seasonType === 2 ? 'bg-zinc-800 text-white' : 'text-zinc-500'
            "
            class="px-3 rounded-lg text-xs font-bold transition-all"
          >
            REG
          </button>
          <button
            @click="setSeasonType(3)"
            :class="
              seasonType === 3 ? 'bg-zinc-800 text-amber-500' : 'text-zinc-500'
            "
            class="px-3 rounded-lg text-xs font-bold transition-all"
          >
            POST
          </button>
        </div>

        <!-- CALENDAR DATE PICKER WITH SHOWPICKER INTERCEPT -->
        <div
          v-if="isDateLeague"
          class="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 h-[38px] cursor-pointer"
          onclick="this.querySelector('input').showPicker()"
        >
          <span
            class="text-xs text-zinc-500 font-bold uppercase tracking-wider select-none"
            >📅 Date:</span
          >
          <input
            type="date"
            v-model="selectedDate"
            @change="handleDateChange"
            class="bg-transparent text-white text-sm font-semibold focus:outline-none scheme-dark cursor-pointer border-none p-0 min-w-[110px]"
          />
        </div>
      </div>
      <div
        class="flex items-center gap-1 bg-zinc-950 border border-zinc-800 p-1 rounded-xl w-fit"
        aria-label="Dashboard view"
      >
        <button
          @click="setDashboardView('scoreboard')"
          :aria-pressed="viewMode === 'scoreboard'"
          :class="
            viewMode === 'scoreboard'
              ? 'bg-blue-600 text-white'
              : 'text-zinc-400 hover:text-white'
          "
          class="px-3 py-2 rounded-lg text-xs font-bold transition-all"
        >
          Scoreboard
        </button>
        <button
          @click="setDashboardView('standings')"
          :aria-pressed="viewMode === 'standings'"
          :class="
            viewMode === 'standings'
              ? 'bg-blue-600 text-white'
              : 'text-zinc-400 hover:text-white'
          "
          class="px-3 py-2 rounded-lg text-xs font-bold transition-all"
        >
          Standings
        </button>
        <button
          @click="setDashboardView('tv-lineup')"
          :aria-pressed="viewMode === 'tv-lineup'"
          :class="
            viewMode === 'tv-lineup'
              ? 'bg-blue-600 text-white'
              : 'text-zinc-400 hover:text-white'
          "
          class="whitespace-nowrap px-3 py-2 rounded-lg text-xs font-bold transition-all"
        >
          TV Lineup
        </button>
      </div>
    </div>

    <div
      role="status"
      :aria-label="refreshIndicatorFailed ? 'Refresh failed' : 'Refreshing data'"
      :aria-hidden="!refreshIndicatorActive && !refreshIndicatorFailed"
      class="relative mb-5 h-px w-full overflow-hidden"
    >
      <div
        v-if="refreshIndicatorActive || refreshIndicatorFailed"
        class="absolute inset-0"
        :class="[
          refreshIndicatorFailed ? 'bg-orange-400' : 'bg-green-400',
          refreshIndicatorActive && !refreshIndicatorFailed
            ? 'scoreboard-refresh-sweep'
            : '',
        ]"
      ></div>
    </div>

    <p
      v-if="viewMode !== 'standings' && scoreboardRefreshStale && lastSuccessfulRefreshAt !== null"
      role="status"
      class="mb-4 text-xs text-zinc-500"
    >
      Last updated at {{ formatLastUpdatedAt(lastSuccessfulRefreshAt) }}
    </p>

    <!-- MAIN SCORE CARD GRID -->
    <section v-if="viewMode === 'standings'" class="space-y-6">
      <div
        v-if="standingsLoading"
        class="flex flex-col items-center justify-center py-24 text-zinc-500"
      >
        <div
          class="w-9 h-9 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"
        ></div>
        <p class="text-sm tracking-wide">Loading standings...</p>
      </div>
      <div
        v-else-if="standingsError"
        class="border border-red-900/60 bg-red-950/20 rounded-xl p-4 text-sm text-red-300"
      >
        {{ standingsError }}
      </div>
      <div
        v-else-if="visibleStandings.length === 0"
        class="text-center py-20 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/10"
      >
        <p class="text-zinc-400 font-semibold text-base">
          {{ standings.length ? 'No standings are available for this conference.' : 'No standings are available for this league.' }}
        </p>
      </div>
      <section
        v-for="group in visibleStandings"
        :key="group.id"
        class="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 sm:p-5"
        :style="{ marginLeft: `${Math.min(group.depth, 3) * 1}rem` }"
      >
        <h2 class="text-sm sm:text-base font-black text-white mb-3">
          {{ group.name }}
        </h2>
        <div class="overflow-x-auto">
          <table class="w-full min-w-max text-left text-xs sm:text-sm">
            <thead
              class="text-[10px] text-zinc-500 uppercase tracking-wider border-b border-zinc-800"
            >
              <tr>
                <th class="sticky left-0 z-20 bg-zinc-900 py-2 pr-4">Team</th>
                <th
                  v-for="column in group.columns"
                  :key="column.key"
                  :aria-sort="
                    getStandingSortDirection(group.id, column.key) === 'asc'
                      ? 'ascending'
                      : getStandingSortDirection(group.id, column.key) ===
                          'desc'
                        ? 'descending'
                        : 'none'
                  "
                  class="py-2 px-3 text-right"
                >
                  <button
                    type="button"
                    class="inline-flex w-full items-center justify-end gap-1 hover:text-zinc-200"
                    @click="toggleStandingsSort(group.id, column.key)"
                  >
                    {{ column.label }}
                    <span aria-hidden="true" class="text-zinc-500">
                      {{
                        getStandingSortDirection(group.id, column.key) === "asc"
                          ? "↑"
                          : getStandingSortDirection(group.id, column.key) ===
                              "desc"
                            ? "↓"
                            : "↕"
                      }}
                    </span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="team in getSortedStandingTeams(group)"
                :key="team.id"
                class="border-b border-zinc-800/60 last:border-0"
              >
                <td class="sticky left-0 z-10 bg-zinc-900 py-2.5 pr-4">
                  <div class="flex items-center gap-2 min-w-[150px]">
                    <img
                      v-if="team.logo"
                      :src="team.logo"
                      :alt="`${team.name} logo`"
                      class="w-6 h-6 object-contain"
                      loading="lazy"
                    />
                    <button
                      type="button"
                      class="font-bold text-white hover:text-blue-400"
                      @click="openTeamDetails(team)"
                    >
                      {{ team.name }}
                    </button>
                    <span
                      v-if="team.note"
                      class="text-[10px] text-emerald-400"
                      :title="team.note"
                      >*</span
                    >
                  </div>
                </td>
                <td
                  v-for="column in group.columns"
                  :key="column.key"
                  class="py-2.5 px-3 text-right font-mono text-zinc-300"
                >
                  {{ getStandingStat(team, column.key) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>
    <div
      v-else-if="loading"
      class="flex flex-col items-center justify-center py-24 text-zinc-500"
    >
      <div
        class="w-9 h-9 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"
      ></div>
      <p class="text-sm tracking-wide">Syncing data streams...</p>
    </div>

    <div
      v-else-if="games.length === 0"
      class="text-center py-20 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/10"
    >
      <p class="text-zinc-400 font-semibold text-base">
        No active games scheduled for this frame.
      </p>
    </div>

    <section v-else-if="viewMode === 'tv-lineup'" class="space-y-5">
      <div
        v-if="!tvLineup.channels.length && !tvLineup.unscheduled.length"
        class="rounded-xl border border-dashed border-zinc-800 py-16 text-center text-sm text-zinc-400"
      >
        No games scheduled for this day.
      </div>
      <div
        v-if="tvLineup.channels.length"
        class="rounded-xl border border-zinc-800 bg-zinc-950/50"
      >
        <div
          class="sticky top-0 z-40 flex overflow-hidden border-b border-zinc-700 bg-zinc-950"
        >
          <div
            class="flex w-28 shrink-0 items-center border-r border-zinc-700 px-3 py-2 text-[10px] font-bold uppercase text-zinc-500"
          >
            Network
          </div>
          <div class="min-w-0 flex-1 overflow-hidden">
            <div
              class="flex"
              :style="{
                width: `${tvLineup.ticks.length * tvLineup.scale}px`,
                transform: `translateX(-${tvLineupScrollLeft}px)`,
              }"
            >
              <div
                v-for="tick in tvLineup.ticks"
                :key="tick.timestamp"
                class="h-9 shrink-0 border-r border-zinc-800 px-1 py-2 text-center font-mono text-[10px] text-zinc-400"
                :style="{ width: `${tvLineup.scale}px` }"
              >
                {{ tick.label }}
              </div>
            </div>
          </div>
        </div>

        <div class="overflow-x-auto" @scroll="handleTvLineupScroll">
          <div class="min-w-max">
            <div
              v-for="channel in tvLineup.channels"
              :key="channel.name"
              class="flex border-b-2 border-zinc-700 last:border-0"
            >
              <div
                class="sticky left-0 z-30 flex w-28 shrink-0 items-center border-r border-zinc-800 bg-zinc-950 px-3 text-xs font-bold text-zinc-300"
              >
                <span class="truncate" :title="channel.name">{{
                  channel.name
                }}</span>
              </div>
              <div
                class="relative shrink-0"
                :style="{
                  width: `${tvLineup.timelineWidth}px`,
                  height: `${channel.laneCount * tvLineup.laneHeight}px`,
                }"
              >
                <div
                  v-for="line in tvLineup.gridlines"
                  :key="line.index"
                  aria-hidden="true"
                  class="absolute inset-y-0 z-0 border-l border-zinc-800/70"
                  :style="{ left: `${line.left}px` }"
                ></div>
                <button
                  v-for="entry in channel.games"
                  :key="entry.game.id"
                  type="button"
                  :aria-label="`${getTeamName(entry.game, 'away')} at ${getTeamName(entry.game, 'home')}, ${entry.status}`"
                  :title="`${getTeamName(entry.game, 'away')} at ${getTeamName(entry.game, 'home')} · ${entry.status}`"
                  @click.stop="handleGameClick(entry.game)"
                  class="absolute z-10 grid grid-cols-[26px_minmax(0,1fr)_26px] grid-rows-3 items-center gap-1 overflow-hidden rounded border bg-zinc-900 text-left shadow-sm transition-colors"
                  :class="[
                    isGameHighlighted(entry.game)
                      ? 'border-amber-500 ring-1 ring-amber-500/30'
                      : 'border-zinc-700',
                    'cursor-pointer hover:bg-zinc-800 active:bg-zinc-700',
                  ]"
                  :style="{
                    left: `${entry.left}px`,
                    top: `${entry.lane * tvLineup.laneHeight + 4}px`,
                    width: `${entry.width}px`,
                    height: `${tvLineup.laneHeight - 8}px`,
                  }"
                >
                  <img
                    :src="getTeamLogo(entry.game, 'away')"
                    :alt="`${getTeamName(entry.game, 'away')} logo`"
                    class="col-start-1 row-start-1 h-6 w-6 translate-y-2 self-center object-contain"
                    loading="lazy"
                  />
                  <div class="col-start-2 row-span-3 min-w-0 space-y-1 px-0.5">
                    <div
                      class="flex min-w-0 items-center justify-between gap-1 rounded-sm border-b border-zinc-800/80 px-1 pb-0.5"
                      :style="getTvLineupTeamStyle(entry.game, 'away')"
                    >
                      <span class="truncate text-[11px] font-semibold">{{
                        getTeamName(entry.game, "away")
                      }}</span>
                      <span
                        v-if="getGameState(entry.game) !== 'pre'"
                        class="shrink-0 font-mono text-xs font-black"
                        >{{ getTeamScore(entry.game, "away") }}</span
                      >
                    </div>
                    <div
                      class="flex min-w-0 items-center justify-between gap-1 rounded-sm border-b border-zinc-800/80 px-1 pb-0.5"
                      :style="getTvLineupTeamStyle(entry.game, 'home')"
                    >
                      <span class="truncate text-[11px] font-semibold">{{
                        getTeamName(entry.game, "home")
                      }}</span>
                      <span
                        v-if="getGameState(entry.game) !== 'pre'"
                        class="shrink-0 font-mono text-xs font-black"
                        >{{ getTeamScore(entry.game, "home") }}</span
                      >
                    </div>
                    <div
                      class="truncate text-[10px] font-bold uppercase text-zinc-400"
                      :class="{
                        'text-red-400': getGameState(entry.game) === 'in',
                      }"
                    >
                      {{ entry.status }}
                    </div>
                  </div>
                  <img
                    :src="getTeamLogo(entry.game, 'home')"
                    :alt="`${getTeamName(entry.game, 'home')} logo`"
                    class="col-start-3 row-span-3 h-6 w-6 self-center object-contain"
                    loading="lazy"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section v-if="tvLineup.unscheduled.length" class="space-y-2">
        <h2 class="text-xs font-bold uppercase text-zinc-500">Time TBD</h2>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <button
            v-for="entry in tvLineup.unscheduled"
            :key="entry.game.id"
            type="button"
            :aria-label="`${getTeamName(entry.game, 'away')} at ${getTeamName(entry.game, 'home')}, ${entry.status}`"
            @click.stop="handleGameClick(entry.game)"
            class="grid min-h-[84px] grid-cols-[30px_minmax(0,1fr)_30px] grid-rows-3 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/80 p-2 text-left cursor-pointer hover:bg-zinc-800"
          >
            <img
              :src="getTeamLogo(entry.game, 'away')"
              :alt="`${getTeamName(entry.game, 'away')} logo`"
              class="col-start-1 row-start-1 h-6 w-6 translate-y-2 self-center object-contain"
              loading="lazy"
            />
            <div class="col-start-2 row-span-3 min-w-0 space-y-1">
              <div
                class="flex items-center justify-between gap-2 rounded-sm border-b border-zinc-800 px-1 pb-1"
                :style="getTvLineupTeamStyle(entry.game, 'away')"
              >
                <span class="truncate text-xs font-semibold">{{
                  getTeamName(entry.game, "away")
                }}</span>
                <span
                  v-if="getGameState(entry.game) !== 'pre'"
                  class="font-mono text-xs font-black"
                  >{{ getTeamScore(entry.game, "away") }}</span
                >
              </div>
              <div
                class="flex items-center justify-between gap-2 rounded-sm border-b border-zinc-800 px-1 pb-1"
                :style="getTvLineupTeamStyle(entry.game, 'home')"
              >
                <span class="truncate text-xs font-semibold">{{
                  getTeamName(entry.game, "home")
                }}</span>
                <span
                  v-if="getGameState(entry.game) !== 'pre'"
                  class="font-mono text-xs font-black"
                  >{{ getTeamScore(entry.game, "home") }}</span
                >
              </div>
              <div
                class="truncate text-[10px] font-bold uppercase text-zinc-400"
              >
                {{ entry.channel }} · {{ entry.status }}
              </div>
            </div>
            <img
              :src="getTeamLogo(entry.game, 'home')"
              :alt="`${getTeamName(entry.game, 'home')} logo`"
              class="col-start-3 row-span-3 h-7 w-7 self-center object-contain"
              loading="lazy"
            />
          </button>
        </div>
      </section>
    </section>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <div
        v-for="game in sortedGames"
        :key="game.id"
        role="button"
        tabindex="0"
        :aria-label="`${getTeamName(game, 'away')} at ${getTeamName(game, 'home')}`"
        @click.stop="handleGameClick(game)"
        @keydown.enter.prevent="handleGameClick(game)"
        @keydown.space.prevent="handleGameClick(game)"
        class="w-full text-left bg-zinc-900/90 border rounded-2xl p-4 transition-all duration-150 backdrop-blur-sm shadow-sm hover:bg-zinc-800/60 block select-none touch-manipulation appearance-none [webkit-tap-highlight-color:transparent]"
        :class="[
          isGameHighlighted(game)
            ? 'border-amber-500 shadow-amber-500/10 shadow-lg ring-1 ring-amber-500/20'
            : 'border-zinc-800/80',
          'cursor-pointer active:scale-[0.99] active:bg-zinc-800/90',
        ]"
      >
        <!-- TOP EVENT META BAR -->
        <div
          class="flex items-center justify-between border-b border-zinc-800/60 pb-3 mb-3.5 text-xs"
        >
          <div class="flex items-center gap-2">
            <span
              v-if="getGameState(game) === 'in'"
              class="bg-red-600 text-white px-1.5 py-0.5 rounded font-black text-[10px] tracking-widest live-pulse"
              >LIVE</span
            >
            <span
              v-else-if="getGameState(game) === 'pre'"
              class="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-bold text-[10px] tracking-wider"
              >UPCOMING</span
            >
            <span
              v-else
              class="bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded font-bold text-[10px] tracking-wider"
              >FINAL</span
            >

            <span
              v-if="getNetwork(game)"
              class="text-zinc-400 font-bold px-1.5 bg-zinc-950 rounded border border-zinc-800 text-[10px]"
              >{{ getNetwork(game) }}</span
            >
            <span class="text-zinc-400 font-medium">{{
              formatGameTime(game)
            }}</span>
          </div>

          <div
            v-if="getSituation(game)"
            class="text-amber-400 font-semibold tracking-tight bg-amber-500/10 px-2 py-0.5 rounded-full text-[11px]"
          >
            {{ getSituation(game) }}
          </div>
        </div>

        <p
          v-if="getSeriesSummary(game.competitions?.[0])"
          class="-mt-2 mb-3 text-[11px] font-semibold text-zinc-400 truncate"
        >
          {{ getSeriesSummary(game.competitions?.[0]) }}
        </p>

        <!-- TEAM MATRIX VALUES ROW (RANK INLINE & STRIPPED) -->
        <div class="space-y-3.5">
          <!-- AWAY SLOT -->
          <div
            class="flex items-center justify-between"
            :class="{
              'opacity-40':
                getGameState(game) === 'post' && !isWinner(game, 'away'),
            }"
          >
            <div class="flex items-center gap-2 min-w-0">
              <img
                :src="getTeamLogo(game, 'away')"
                class="w-6 h-6 object-contain flex-shrink-0"
                loading="lazy"
              />
              <span
                class="font-bold text-white tracking-tight truncate text-sm"
                :class="{
                  'text-amber-400 font-black': isTeamHighlighted(game, 'away'),
                }"
              >
                <span
                  v-if="getTeamRank(game, 'away')"
                  class="text-zinc-400 font-bold mr-1"
                  >#{{ getTeamRank(game, "away") }}</span
                >{{ getTeamName(game, "away") }}
              </span>
              <span
                v-if="hasPossession(game, 'away')"
                class="text-amber-500 text-xs animate-pulse"
                >🏈</span
              >
            </div>
            <div class="font-mono text-xl font-black text-white pl-4">
              {{ getTeamScore(game, "away") }}
            </div>
          </div>

          <!-- HOME SLOT -->
          <div
            class="flex items-center justify-between"
            :class="{
              'opacity-40':
                getGameState(game) === 'post' && !isWinner(game, 'home'),
            }"
          >
            <div class="flex items-center gap-2 min-w-0">
              <img
                :src="getTeamLogo(game, 'home')"
                class="w-6 h-6 object-contain flex-shrink-0"
                loading="lazy"
              />
              <span
                class="font-bold text-white tracking-tight truncate text-sm"
                :class="{
                  'text-amber-400 font-black': isTeamHighlighted(game, 'home'),
                }"
              >
                <span
                  v-if="getTeamRank(game, 'home')"
                  class="text-zinc-400 font-bold mr-1"
                  >#{{ getTeamRank(game, "home") }}</span
                >{{ getTeamName(game, "home") }}
              </span>
              <span
                v-if="hasPossession(game, 'home')"
                class="text-amber-500 text-xs animate-pulse"
                >🏈</span
              >
            </div>
            <div class="font-mono text-xl font-black text-white pl-4">
              {{ getTeamScore(game, "home") }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- GAMECAST DETAILS MODAL DRAWER -->
    <div
      v-if="showModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto"
      @click.self="closeModal"
    >
      <div
        class="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col relative text-sm"
      >
        <!-- MODAL LOADING STATE -->
        <div
          v-if="modalLoading"
          class="flex flex-col items-center justify-center py-32 text-zinc-500 w-full"
        >
          <div
            class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"
          ></div>
          <p class="text-xs">Fetching live summary metrics...</p>
        </div>

        <div
          v-else-if="!modalData && modalView !== 'team'"
          class="p-8 text-center text-zinc-400 relative"
        >
          <button
            @click="closeModal"
            class="absolute top-4 right-4 text-zinc-400 hover:text-white text-xl p-2"
          >
            ✕
          </button>
          Failed to fetch extended match details for this event.
        </div>

        <!-- RE-IMPLEMENTED SAFETY WRAPPER: Completely gates property lookups until modalData populates -->
        <div
          v-if="modalData || modalView === 'team'"
          class="flex flex-col w-full"
        >
          <div
            class="flex justify-end p-2 border-b border-zinc-800/40 bg-zinc-950/20"
          >
            <button
              @click="closeModal"
              class="text-zinc-400 hover:text-white text-xs font-bold px-4 py-2 transition-all"
            >
              ✕ CLOSE WINDOW
            </button>
          </div>

          <div
            v-if="modalView === 'game' && modalData"
            class="p-6 border-b border-zinc-800 bg-zinc-950/40"
          >
            <p
              v-if="summaryRefreshStale && lastSuccessfulSummaryRefreshAt !== null"
              role="status"
              class="mb-3 text-xs text-zinc-500"
            >
              Last updated at {{ formatLastUpdatedAt(lastSuccessfulSummaryRefreshAt) }}
            </p>
            <div
              class="grid grid-cols-7 items-center justify-items-center gap-1 w-full mb-5 pb-3 border-b border-zinc-800/40"
            >
              <!-- AWAY BRAND (Columns 1, 2, 3) -->
              <div
                class="col-span-3 flex flex-col sm:flex-row items-center text-center sm:text-left gap-1 sm:gap-3 w-full min-w-0"
              >
                <img
                  :src="modalData.teams.away.logo"
                  class="w-8 h-8 sm:w-10 sm:h-10 object-contain shrink-0"
                />
                <div class="min-w-0 w-full">
                  <h3
                    class="text-xs sm:text-base font-bold text-white truncate px-1"
                  >
                    <span
                      v-if="modalData.teams.away.rank"
                      class="text-amber-500 font-black text-[10px] sm:text-sm mr-0.5"
                      >#{{ modalData.teams.away.rank }}</span
                    >
                    <!-- 🟢 Shows abbreviation on tiny screens, full name everywhere else -->
                    <button
                      @click.stop="openTeamDetails('away')"
                      class="block sm:hidden w-full text-left truncate hover:text-blue-400"
                    >
                      {{
                        modalData.teams.away.abbrev || modalData.teams.away.name
                      }}
                    </button>
                    <button
                      @click.stop="openTeamDetails('away')"
                      class="hidden sm:inline truncate hover:text-blue-400"
                    >
                      {{ modalData.teams.away.name }}
                    </button>
                  </h3>
                  <p
                    class="text-[9px] sm:text-[11px] text-zinc-400 tracking-wider uppercase"
                  >
                    Away
                  </p>
                </div>
              </div>

              <!-- CENTER LIVE RUNNING SCORE WITH INTEGRATED POSSESSION LOGIC (Column 4) -->
              <div
                class="col-span-1 flex flex-col items-center justify-center font-mono select-none px-1"
              >
                <div
                  class="flex items-center bg-zinc-950 px-2 py-1 sm:px-4 sm:py-2 rounded-xl border border-zinc-800/80 text-sm sm:text-2xl font-black text-white whitespace-nowrap"
                >
                  <!-- Football emoji lights up if Away has possession -->
                  <span
                    v-if="
                      leagueBehavior?.linescore.supportsPossession &&
                      hasPossession(
                        games.find((g) => g.id === modalData!.id),
                        'away',
                      )
                    "
                    class="text-amber-500 text-xs sm:text-sm animate-pulse mr-1 sm:mr-2"
                    >🏈</span
                  >

                  <span>{{ modalData.teams.away.score }}</span>
                  <span
                    class="text-zinc-600 text-xs sm:text-lg font-normal font-sans mx-1 sm:mx-1.5"
                    >vs</span
                  >
                  <span>{{ modalData.teams.home.score }}</span>

                  <!-- Football emoji lights up if Home has possession -->
                  <span
                    v-if="
                      leagueBehavior?.linescore.supportsPossession &&
                      hasPossession(
                        games.find((g) => g.id === modalData!.id),
                        'home',
                      )
                    "
                    class="text-amber-500 text-xs sm:text-sm animate-pulse ml-1 sm:mr-2"
                    >🏈</span
                  >
                </div>
              </div>

              <!-- HOME BRAND (Columns 5, 6, 7) -->
              <div
                class="col-span-3 flex flex-col-reverse sm:flex-row items-center text-center sm:text-right gap-1 sm:gap-3 w-full min-w-0 justify-end"
              >
                <div class="min-w-0 w-full">
                  <h3
                    class="text-xs sm:text-base font-bold text-white truncate px-1"
                  >
                    <span
                      v-if="modalData.teams.home.rank"
                      class="text-amber-500 font-black text-[10px] sm:text-sm mr-0.5"
                      >#{{ modalData.teams.home.rank }}</span
                    >
                    <!-- 🟢 Shows abbreviation on tiny screens, full name everywhere else -->
                    <button
                      @click.stop="openTeamDetails('home')"
                      class="block sm:hidden w-full text-right truncate hover:text-blue-400"
                    >
                      {{
                        modalData.teams.home.abbrev || modalData.teams.home.name
                      }}
                    </button>
                    <button
                      @click.stop="openTeamDetails('home')"
                      class="hidden sm:inline truncate hover:text-blue-400"
                    >
                      {{ modalData.teams.home.name }}
                    </button>
                  </h3>
                  <p
                    class="text-[9px] sm:text-[11px] text-zinc-400 tracking-wider uppercase"
                  >
                    Home
                  </p>
                </div>
                <img
                  :src="modalData.teams.home.logo"
                  class="w-8 h-8 sm:w-10 sm:h-10 object-contain shrink-0"
                />
              </div>
            </div>

            <p
              v-if="modalView === 'game' && modalSeriesSummary"
              class="mb-4 text-center text-xs font-semibold text-zinc-400"
            >
              {{ modalSeriesSummary }}
            </p>

            <div
              v-if="modalView === 'game'"
              class="overflow-x-auto w-full bg-zinc-950/40 p-3 rounded-xl border border-zinc-800/60"
            >
              <table
                class="w-full text-center font-mono text-xs text-zinc-300 min-w-[280px]"
              >
                <thead>
                  <tr
                    class="text-zinc-500 border-b border-zinc-800/80 pb-1.5 uppercase font-sans tracking-widest text-[10px]"
                  >
                    <th class="text-left font-medium px-2">TEAM</th>
                    <th
                      v-for="head in linescoreHeaders"
                      :key="head"
                      class="px-2 font-black"
                    >
                      {{ head }}
                    </th>
                    <th
                      class="px-2 font-black text-white border-l border-zinc-800/80 pl-3"
                    >
                      TOT
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-900/60">
                  <tr class="h-9">
                    <td
                      class="text-left font-sans font-bold text-zinc-400 px-2"
                    >
                      {{ modalData.teams.away.abbrev }}
                    </td>
                    <td
                      v-for="(val, idx) in linescores.away"
                      :key="'away-' + idx"
                      class="px-2 font-bold text-zinc-300"
                    >
                      {{ val }}
                    </td>
                    <td
                      class="px-2 font-black text-amber-400 border-l border-zinc-800/80 bg-zinc-950/40 pl-3 text-sm"
                    >
                      {{ modalData.teams.away.score }}
                    </td>
                  </tr>
                  <tr class="h-9">
                    <td
                      class="text-left font-sans font-bold text-zinc-400 px-2"
                    >
                      {{ modalData.teams.home.abbrev }}
                    </td>
                    <td
                      v-for="(val, idx) in linescores.home"
                      :key="'home-' + idx"
                      class="px-2 font-bold text-zinc-300"
                    >
                      {{ val }}
                    </td>
                    <td
                      class="px-2 font-black text-amber-400 border-l border-zinc-800/80 bg-zinc-950/40 pl-3 text-sm"
                    >
                      {{ modalData.teams.home.score }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div
            v-if="modalView === 'game'"
            role="tablist"
            aria-label="Game center views"
            class="flex gap-1 overflow-x-auto bg-zinc-950/60 border-b border-zinc-800 p-1"
          >
            <button
              v-for="tab in modalTabs"
              :key="tab.id"
              type="button"
              role="tab"
              :aria-selected="modalTab === tab.id"
              @click="modalTab = tab.id"
              :class="
                modalTab === tab.id
                  ? 'bg-zinc-800 text-white font-bold'
                  : 'text-zinc-400'
              "
              class="min-w-fit flex-1 text-center px-3 py-2.5 rounded-lg text-[10px] sm:text-xs tracking-wider font-semibold transition-all"
            >
              {{ tab.label }}
            </button>
          </div>

          <div v-if="modalView === 'game'" class="p-6 flex-1 bg-zinc-900">
            <section v-if="modalTab === 'matchup'" class="space-y-5">
              <div class="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-4">
                <div>
                  <h4 class="text-sm font-black uppercase tracking-wider text-white">Matchup</h4>
                  <p class="mt-1 text-xs text-zinc-400">
                    {{ pregameMatchup.date ? formatMatchupDate(pregameMatchup.date) : 'Start time TBD' }}
                  </p>
                </div>
                <div v-if="pregameMatchup.venue" class="text-right text-xs text-zinc-400">
                  <p class="font-semibold text-zinc-200">{{ pregameMatchup.venue }}</p>
                  <p v-if="pregameMatchup.venueLocation">{{ pregameMatchup.venueLocation }}</p>
                </div>
              </div>

              <div v-if="pregameMatchup.away && pregameMatchup.home" class="grid grid-cols-1 gap-3 md:grid-cols-2">
                <article
                  v-for="team in [pregameMatchup.away, pregameMatchup.home]"
                  :key="team.homeAway"
                  class="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4"
                >
                  <div class="flex items-center gap-3 border-b border-zinc-800/80 pb-3">
                    <img v-if="team.logo" :src="team.logo" :alt="`${team.name} logo`" class="h-10 w-10 shrink-0 object-contain" />
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-bold text-white">{{ team.name }}</p>
                      <p class="mt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        {{ team.homeAway }}<span v-if="team.abbreviation"> · {{ team.abbreviation }}</span>
                      </p>
                    </div>
                    <div class="text-right">
                      <p v-if="team.rank" class="text-xs font-black text-amber-400">#{{ team.rank }}</p>
                      <p class="text-xs font-mono font-bold text-zinc-300">{{ team.record || 'Record unavailable' }}</p>
                    </div>
                  </div>

                  <div class="pt-3">
                    <h5 class="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Previous games</h5>
                    <div v-if="team.recentGames.length" class="space-y-2">
                      <div v-for="game in team.recentGames" :key="game.id" class="flex items-center gap-2 text-xs">
                        <span
                          class="w-5 shrink-0 text-center font-black"
                          :class="game.result.toUpperCase().startsWith('W') ? 'text-emerald-400' : game.result.toUpperCase().startsWith('L') ? 'text-rose-400' : 'text-zinc-400'"
                        >{{ game.result || '-' }}</span>
                        <span class="min-w-0 flex-1 truncate text-zinc-300">{{ game.atVs }} {{ game.opponent }}</span>
                        <span class="shrink-0 font-mono text-zinc-500">{{ game.score }}</span>
                        <span class="shrink-0 text-[10px] text-zinc-500">{{ formatRecentGameDate(game.date) }}</span>
                      </div>
                    </div>
                    <p v-else class="text-xs text-zinc-500">{{ matchupLoading ? 'Loading previous games...' : 'Previous games unavailable.' }}</p>
                  </div>
                </article>
              </div>
              <p v-else class="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4 text-sm text-zinc-400">
                Matchup details are not available for this event.
              </p>

              <div v-if="pregameMatchup.series" class="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
                <div class="flex flex-wrap items-baseline justify-between gap-2">
                  <h5 class="text-xs font-bold uppercase tracking-wider text-zinc-400">{{ pregameMatchup.series.title }}</h5>
                  <span v-if="pregameMatchup.series.score" class="font-mono text-sm font-black text-amber-400">{{ pregameMatchup.series.score }}</span>
                </div>
                <p class="mt-2 text-sm text-zinc-200">{{ pregameMatchup.series.summary }}</p>
              </div>
            </section>

            <section v-else-if="modalTab === 'timeline'" class="space-y-5">
              <div class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                <div>
                  <h4 class="text-sm font-black uppercase tracking-wider text-white">Play-by-play</h4>
                  <p class="mt-1 text-xs text-zinc-500">
                    {{ playTimeline.mode === 'all-plays' ? 'Full play history' : playTimeline.mode === 'scoring-only' ? 'Scoring plays only' : 'Event history unavailable' }}
                  </p>
                </div>
                <div v-if="playTimeline.mode === 'all-plays'" class="flex min-h-11 items-center gap-3 text-xs font-semibold text-zinc-300">
                  <span>Scoring only</span>
                  <button
                    type="button"
                    role="switch"
                    :aria-checked="showScoringOnly"
                    aria-label="Show scoring plays only"
                    @click="showScoringOnly = !showScoringOnly"
                    class="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
                    :class="showScoringOnly ? 'bg-amber-500' : 'bg-zinc-700'"
                  >
                    <span class="sr-only">Show scoring plays only</span>
                    <span
                      class="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform"
                      :class="showScoringOnly ? 'translate-x-6' : 'translate-x-1'"
                    ></span>
                  </button>
                </div>
              </div>

              <div v-if="playTimeline.mode === 'unavailable'" class="rounded-xl border border-zinc-800 bg-zinc-950/30 p-5 text-sm text-zinc-400">
                ESPN did not provide play-by-play or scoring events for this game.
              </div>
              <div v-else-if="playTimeline.mode === 'scoring-only'" class="rounded-lg border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
                ESPN provides scoring events for this game, but not a full play-by-play timeline.
              </div>

              <div v-if="timelineGroups.length" class="space-y-5">
                <section v-for="group in timelineGroups" :key="group.label">
                  <h5 class="mb-2 border-b border-zinc-800 pb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{{ group.label }}</h5>
                  <div class="divide-y divide-zinc-800/70">
                    <article
                      v-for="event in group.events"
                      :key="event.id"
                      class="grid grid-cols-[58px_minmax(0,1fr)] gap-3 py-3"
                      :class="event.scoring ? 'border-l-2 border-amber-400 pl-3' : 'pl-3'"
                    >
                      <div class="space-y-1 text-right">
                        <p class="font-mono text-[10px] font-bold text-zinc-400">{{ event.clock || event.eventType || 'Play' }}</p>
                        <p v-if="event.teamAbbreviation" class="truncate text-[9px] font-bold uppercase text-zinc-500">{{ event.teamAbbreviation }}</p>
                      </div>
                      <div class="min-w-0">
                        <div class="flex flex-wrap items-start justify-between gap-2">
                          <p class="min-w-0 flex-1 text-xs leading-relaxed text-zinc-200">{{ event.description }}</p>
                          <span v-if="event.awayScore !== null && event.homeScore !== null" class="shrink-0 rounded bg-zinc-950 px-2 py-1 font-mono text-[10px] font-black text-white">
                            {{ event.awayScore }} - {{ event.homeScore }}
                          </span>
                        </div>
                        <div v-if="event.downDistance || event.fieldPosition || event.pitchCount !== null || event.outs !== null || event.isTurnover || event.isPenalty" class="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-500">
                          <span v-if="event.downDistance">{{ event.downDistance }}</span>
                          <span v-if="event.fieldPosition">{{ event.fieldPosition }}</span>
                          <span v-if="event.outs !== null">{{ event.outs }} outs</span>
                          <span v-if="event.pitchCount !== null">{{ event.pitchCount }} pitches</span>
                          <span v-if="event.isTurnover" class="font-bold text-rose-400">Turnover</span>
                          <span v-if="event.isPenalty" class="font-bold text-amber-400">Penalty</span>
                        </div>
                      </div>
                    </article>
                  </div>
                </section>
              </div>
              <p v-else-if="playTimeline.mode === 'all-plays'" class="text-sm text-zinc-500">
                No scoring plays match this filter.
              </p>
            </section>

            <section v-else-if="modalTab === 'flow'" class="space-y-5">
              <div class="border-b border-zinc-800 pb-4">
                <h4 class="text-sm font-black uppercase tracking-wider text-white">Game flow</h4>
                <p class="mt-1 text-xs text-zinc-500">Score progression and scoring events</p>
              </div>

              <div v-if="gameFlow.points.length" class="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                <div class="mb-3 flex flex-wrap items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wider">
                  <span :style="{ color: gameFlowColors.away }">{{ modalData!.teams.away.abbrev }} score</span>
                  <span :style="{ color: gameFlowColors.home }">{{ modalData!.teams.home.abbrev }} score</span>
                </div>
                <div class="h-44 w-full rounded-lg bg-zinc-950/70 p-2 sm:h-56">
                  <svg class="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Score progression chart">
                    <line x1="0" y1="50" x2="100" y2="50" stroke="#3f3f46" stroke-width="0.6" stroke-dasharray="2 3" />
                    <polyline :points="gameFlow.awayPoints" fill="none" :stroke="gameFlowColors.away" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                    <polyline :points="gameFlow.homePoints" fill="none" :stroke="gameFlowColors.home" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </div>
                <div class="mt-3 flex justify-between text-[9px] uppercase tracking-wider text-zinc-600">
                  <span>Start</span><span>End of game</span>
                </div>
              </div>
              <p v-else class="rounded-xl border border-zinc-800 bg-zinc-950/30 p-5 text-sm text-zinc-400">
                Score progression is unavailable because ESPN did not provide scoring events with score snapshots.
              </p>

              <div v-if="gameFlow.markers.length" class="space-y-2">
                <h5 class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Scoring events</h5>
                <div class="divide-y divide-zinc-800/70">
                  <div v-for="marker in gameFlow.markers" :key="`flow-${marker.event!.id}`" class="flex items-start gap-3 py-2.5">
                    <span class="shrink-0 font-mono text-[10px] font-black text-amber-400">{{ marker.awayScore }} - {{ marker.homeScore }}</span>
                    <span class="min-w-0 flex-1 text-xs text-zinc-300">{{ marker.event!.description }}</span>
                    <span class="shrink-0 text-[10px] text-zinc-500">{{ marker.event!.periodLabel }}</span>
                  </div>
                </div>
              </div>

            </section>

            <div v-else-if="modalTab === 'stats'" class="space-y-6">
              <div
                v-if="currentDrive"
                class="bg-blue-950/30 border border-blue-900/50 rounded-xl p-3.5 mb-4"
              >
                <div class="flex items-center justify-between mb-1.5 text-xs">
                  <span
                    class="text-blue-400 font-bold uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <span
                      class="w-2 h-2 rounded-full bg-red-500 animate-ping"
                    ></span>
                    Live Drive
                  </span>
                  <span class="text-zinc-400 font-mono font-medium">{{
                    currentDrive.result || "In progress..."
                  }}</span>
                </div>
                <p class="text-white font-bold text-sm tracking-tight mb-0.5">
                  {{ currentDrive.description }}
                </p>
                <p
                  v-if="currentDrive.recap"
                  class="text-xs text-zinc-400 font-medium"
                >
                  {{ currentDrive.recap }}
                </p>
              </div>

              <div
                v-if="winProbabilityChart.points"
                class="bg-zinc-950/40 border border-zinc-800/80 rounded-xl p-4"
              >
                <h4
                  class="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3"
                >
                  Live Win Probability Trend
                </h4>
                <div
                  class="w-full h-24 relative bg-zinc-950/80 rounded-lg border border-zinc-900/60 p-1"
                >
                  <div
                    class="absolute left-2 top-1.5 text-[9px] font-bold text-zinc-500 uppercase"
                  >
                    {{ modalData!.teams.away.abbrev }} Advantage
                  </div>
                  <div
                    class="absolute left-2 bottom-1.5 text-[9px] font-bold text-zinc-500 uppercase"
                  >
                    {{ modalData!.teams.home.abbrev }} Advantage
                  </div>
                  <svg
                    class="w-full h-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    <line
                      x1="0"
                      y1="50"
                      x2="100"
                      y2="50"
                      stroke="#333333"
                      stroke-width="1"
                      stroke-dasharray="4"
                    />
                    <polyline
                      fill="none"
                      stroke="#eab308"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      :points="winProbabilityChart.points"
                    />
                    <circle
                      v-if="winProbabilityChart.singlePoint"
                      :cx="winProbabilityChart.singlePoint.x"
                      :cy="winProbabilityChart.singlePoint.y"
                      r="2.5"
                      fill="#eab308"
                      stroke="#18181b"
                      stroke-width="1"
                    />
                  </svg>
                </div>
              </div>

              <div class="space-y-3.5 mt-2">
                <div v-if="leagueBehavior?.game.teamStatsMode === 'grouped'" class="flex justify-end">
                  <select
                    v-model="mlbStatGroup"
                    aria-label="MLB stat category"
                    class="bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-3 py-2 text-xs font-bold uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="batting">Batting</option>
                    <option value="pitching">Pitching</option>
                    <option value="fielding">Fielding</option>
                  </select>
                </div>
                <!-- Loop through our customized teamStats computed property instead of raw attributes -->
                <div
                  v-for="stat in teamStats"
                  :key="stat.label"
                  class="border-b border-zinc-800/40 pb-3"
                >
                  <div
                    class="flex justify-between items-center text-xs font-medium mb-1.5"
                  >
                    <span class="font-mono text-zinc-300 font-bold">{{
                      stat.awayDisplay
                    }}</span>
                    <span
                      class="text-zinc-400 uppercase tracking-wider font-semibold text-[10px]"
                      >{{ stat.label }}</span
                    >
                    <span class="font-mono text-zinc-300 font-bold">{{
                      stat.homeDisplay
                    }}</span>
                  </div>
                  <div
                    class="flex h-2 bg-zinc-950 rounded-full overflow-hidden"
                  >
                    <div
                      class="rounded-l-full transition-all duration-300"
                      :style="{
                        width: stat.awayPct + '%',
                        backgroundColor: teamStatBarColors.away,
                      }"
                    ></div>
                    <div class="bg-zinc-800/80 flex-1"></div>
                    <div
                      class="rounded-r-full transition-all duration-300"
                      :style="{
                        width: stat.homePct + '%',
                        backgroundColor: teamStatBarColors.home,
                      }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div
              v-else-if="modalTab === 'boxscore'"
              class="space-y-4"
            >
              <p
                v-if="!playerBoxScore.available"
                class="rounded-xl border border-zinc-800 bg-zinc-950/30 p-5 text-sm text-zinc-400"
              >
                ESPN has not provided player box-score data for this game.
              </p>

              <template v-else>
                <div
                  role="tablist"
                  aria-label="Box score team"
                  class="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 p-1 lg:hidden"
                >
                  <button
                    v-for="team in playerBoxScore.teams"
                    :key="team.side"
                    type="button"
                    role="tab"
                    :aria-selected="selectedBoxScoreSide === team.side"
                    @click="selectedBoxScoreSide = team.side"
                    class="min-h-10 flex-1 rounded-md px-3 text-xs font-bold transition-colors"
                    :class="selectedBoxScoreSide === team.side ? 'bg-zinc-800 text-white' : 'text-zinc-400'"
                  >
                    {{ team.side.toUpperCase() }} · {{ team.abbreviation }}
                  </button>
                </div>

                <div class="space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
                  <section
                    v-for="team in playerBoxScore.teams"
                    :key="team.side"
                    class="min-w-0 space-y-4 border-b border-zinc-800 pb-5 lg:border-b-0 lg:pb-0"
                    :class="selectedBoxScoreSide === team.side ? 'block' : 'hidden lg:block'"
                  >
                    <header class="flex items-center gap-3 border-b border-zinc-800 pb-3">
                      <img v-if="team.logo" :src="team.logo" :alt="`${team.name} logo`" class="h-8 w-8 shrink-0 object-contain" />
                      <div class="min-w-0">
                        <h4 class="truncate text-sm font-black text-white">{{ team.name }}</h4>
                        <p class="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{{ team.side }} · {{ team.abbreviation }}</p>
                      </div>
                    </header>

                    <section v-for="group in team.groups" :key="group.id" class="min-w-0">
                      <h5 class="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">{{ group.title }}</h5>
                      <div class="max-w-full overflow-x-auto rounded-lg border border-zinc-800/80">
                        <table class="w-full min-w-max border-collapse text-left text-xs">
                          <thead class="bg-zinc-950/90 text-[10px] uppercase tracking-wider text-zinc-500">
                            <tr>
                              <th scope="col" class="sticky left-0 z-10 min-w-36 bg-zinc-950 px-3 py-2 font-bold">Player</th>
                              <th v-for="(label, index) in group.labels" :key="`${label}-${index}`" scope="col" class="whitespace-nowrap px-3 py-2 text-right font-bold">{{ label }}</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-zinc-800/70">
                            <tr v-for="player in group.players" :key="player.id" class="hover:bg-zinc-800/30">
                              <th scope="row" class="sticky left-0 z-10 min-w-36 bg-zinc-900 px-3 py-2 text-left font-semibold text-zinc-200">
                                <span class="block max-w-44 truncate">{{ player.name }}</span>
                                <span v-if="player.jersey || player.position" class="mt-0.5 block text-[9px] font-medium uppercase text-zinc-500">
                                  <template v-if="player.jersey">#{{ player.jersey }}</template><template v-if="player.jersey && player.position"> · </template>{{ player.position }}
                                </span>
                              </th>
                              <td v-for="(label, index) in group.labels" :key="`${label}-${index}`" class="whitespace-nowrap px-3 py-2 text-right font-mono text-zinc-300">{{ player.stats[index] ?? '—' }}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </section>

                    <p v-if="!team.groups.length" class="text-xs text-zinc-500">Player stats for this team are not available yet.</p>
                  </section>
                </div>
              </template>
            </div>
          </div>

          <div
            v-else
            class="p-4 sm:p-6 flex-1 bg-zinc-900 space-y-5 sm:space-y-6"
          >
            <div class="flex items-center justify-between gap-3">
              <button
                @click="returnToGame"
                class="text-zinc-400 hover:text-white text-xs font-bold"
              >
                ← BACK
              </button>
              <span class="text-[10px] text-zinc-500 uppercase tracking-widest"
                >Team Details</span
              >
            </div>

            <div
              v-if="teamLoading"
              class="flex flex-col items-center justify-center py-16 text-zinc-500"
            >
              <div
                class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"
              ></div>
              <p class="text-xs">Fetching team details...</p>
            </div>

            <div v-else class="space-y-6">
              <div
                v-if="teamData"
                class="flex items-center gap-3 sm:gap-4 border-b border-zinc-800 pb-5"
              >
                <img
                  :src="
                    teamData.team?.logos?.[0]?.href ||
                    teamData.team?.logo ||
                    selectedTeam.logo
                  "
                  class="w-16 h-16 object-contain"
                />
                <div class="min-w-0">
                  <h3 class="text-lg sm:text-xl font-black text-white truncate">
                    {{ teamData.team?.displayName || selectedTeam.name }}
                  </h3>
                  <p class="text-xs text-zinc-400 mt-1">
                    {{
                      teamData.team?.abbreviation ||
                      selectedTeam.abbrev ||
                      selectedTeam.abbreviation
                    }}<span v-if="teamData.team?.location">
                      · {{ teamData.team.location }}</span
                    >
                  </p>
                  <p
                    v-if="teamData.groups?.name || teamData.team?.groups?.name"
                    class="text-xs text-zinc-500 mt-1"
                  >
                    {{ teamData.groups?.name || teamData.team.groups?.name }}
                  </p>
                </div>
              </div>

              <div
                v-if="teamError"
                class="border border-red-900/60 bg-red-950/20 rounded-xl p-4 text-sm text-red-300"
              >
                {{ teamError }}
              </div>

              <div
                v-if="teamRecords.length || teamRecordStats.length"
                class="space-y-5"
              >
                <div
                  v-if="teamRecords.length"
                  class="grid grid-cols-2 gap-2 sm:gap-3"
                >
                  <div
                    v-for="record in teamRecords"
                    :key="record.label"
                    class="bg-gradient-to-br from-blue-950/60 to-zinc-950/60 border border-blue-900/50 rounded-2xl px-3 sm:px-4 py-3"
                  >
                    <div
                      class="text-[10px] text-blue-300/70 uppercase tracking-widest font-bold"
                    >
                      {{ record.label }}
                    </div>
                    <div
                      class="font-mono text-xl sm:text-2xl font-black text-white mt-1 truncate"
                    >
                      {{ record.value }}
                    </div>
                  </div>
                </div>

                <div v-if="teamRecordStats.length" class="space-y-3">
                  <button
                    @click="showSeasonMetrics = !showSeasonMetrics"
                    class="flex items-center justify-between w-full text-left text-xs font-black text-zinc-400 uppercase tracking-widest hover:text-white"
                  >
                    <span>Season Metrics</span>
                    <span class="text-base leading-none">{{
                      showSeasonMetrics ? "−" : "+"
                    }}</span>
                  </button>
                  <div
                    v-if="showSeasonMetrics"
                    class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3"
                  >
                    <div
                      v-for="stat in teamRecordStats"
                      :key="stat.key"
                      class="bg-zinc-950/70 border border-zinc-800/80 rounded-xl px-2.5 sm:px-3 py-3"
                    >
                      <div
                        class="text-[10px] text-zinc-500 uppercase tracking-wider leading-tight"
                      >
                        {{ stat.label }}
                      </div>
                      <div
                        class="font-mono text-base sm:text-lg font-black text-white mt-2 truncate"
                      >
                        {{ stat.value }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4
                  class="text-xs font-black text-zinc-400 uppercase tracking-widest mb-3"
                >
                  Schedule
                </h4>
                <div
                  v-if="scheduleError"
                  class="border border-red-900/60 bg-red-950/20 rounded-xl p-4 text-sm text-red-300"
                >
                  {{ scheduleError }}
                </div>
                <div
                  v-else-if="teamSchedule.length === 0"
                  class="border border-dashed border-zinc-800 rounded-xl p-8 text-center text-sm text-zinc-500"
                >
                  No schedule available.
                </div>
                <div v-else class="space-y-2">
                  <div
                    v-for="game in teamSchedule"
                    :key="game.id"
                    class="flex items-start justify-between gap-2 sm:gap-3 bg-zinc-950/40 border border-zinc-800/70 rounded-xl p-2.5 sm:p-3"
                  >
                    <div class="min-w-0">
                      <div class="text-[10px] text-zinc-500">
                        {{ game.date
                        }}<span v-if="game.week"> · {{ game.week }}</span>
                      </div>
                      <div
                        class="flex items-center gap-2 text-sm font-bold text-white truncate mt-1"
                      >
                        <img
                          :src="game.opponentLogo"
                          class="w-5 h-5 object-contain shrink-0"
                          loading="lazy"
                        />
                        <span class="truncate"
                          >{{ game.homeAway === "home" ? "vs" : "at" }}
                          {{ game.opponent }}</span
                        >
                      </div>
                      <div
                        v-if="game.venue"
                        class="text-[10px] text-zinc-500 mt-1 truncate"
                      >
                        {{ game.venue }}
                      </div>
                    </div>
                    <div class="text-right shrink-0">
                      <div
                        class="flex items-center gap-2 font-mono font-black text-white"
                      >
                        <img
                          :src="game.teamLogo"
                          class="w-5 h-5 object-contain shrink-0"
                          loading="lazy"
                        />
                        <span>{{ game.score }}</span>
                      </div>
                      <div class="text-[10px] text-zinc-400 uppercase mt-1">
                        {{ game.result || game.status }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- /modalData check safety wrap -->
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, onMounted, ref } from "vue";
import { isTauri } from "@tauri-apps/api/core";
import {
  fetchJson,
  getScoreboardRequestParams,
  getScoreboardUrl,
} from "./api/espn.js";
import { LEAGUES, getLeague } from "./app/leagues";
import { loadPreferences } from "./app/preferences.js";
import { usePreferences } from "./composables/usePreferences";
import { useAppUpdates } from "./composables/useAppUpdates";
import { useAppNavigation } from "./composables/useAppNavigation";
import { useScoreboard } from "./composables/useScoreboard";
import { useGameDetails } from "./composables/useGameDetails";
import { useTeamDetails } from "./composables/useTeamDetails";
import {
  formatGameTime as formatGameTimeUtil,
  formatLastUpdatedAt as formatLastUpdatedAtUtil,
  getCompetitor as getCompetitorUtil,
  getGameState as getGameStateUtil,
  getSeriesSummary as getSeriesSummaryUtil,
  getLinescoreHeaders as getLinescoreHeadersUtil,
  getLinescoreValues as getLinescoreValuesUtil,
  getPlayerBoxScore as getPlayerBoxScoreUtil,
  getBaseballTeamStatComparisons as getBaseballTeamStatComparisonsUtil,
  getNetwork as getNetworkUtil,
  getWinProbabilityChart as getWinProbabilityChartUtil,
  getSituation as getSituationUtil,
  getTeamLogo as getTeamLogoUtil,
  getTeamName as getTeamNameUtil,
  getTeamRank as getTeamRankUtil,
  getTeamScore as getTeamScoreUtil,
  getTeamStatComparisons as getTeamStatComparisonsUtil,
  getGameFlowColors as getGameFlowColorsUtil,
  getTvLineupLayout as getTvLineupLayoutUtil,
  getTvLineupTeamStyle as getTvLineupTeamStyleUtil,
  hasPossession as hasPossessionUtil,
  isGameHighlighted as isGameHighlightedUtil,
  isTeamHighlighted as isTeamHighlightedUtil,
  isWinner as isWinnerUtil,
  sortGames as sortGamesUtil,
} from "./app/scoreboard";
import { filterStandingGroups } from "./domain/standings";
import { normalizeMatchup } from "./domain/matchup.js";
import { normalizePlayByPlay } from "./domain/playByPlay";
import { buildGameFlow } from "./app/gameFlow.js";
import { normalizeSchedule } from "./domain/schedule.js";
import {
  canGoBackWithinApp,
  reconcileAppSnapshot,
  readAppHistoryEntry,
  replaceAppHistoryEntry,
} from "./app/navigation.js";
import {
  getTeamRecords,
  getTeamRecordStats,
  normalizeTeamDetails,
} from "./domain/team.js";
import { resolveLeague } from "./plugins/registry";
import { useStandings } from "./composables/useStandings";
import { useRefreshNotice } from "./composables/useRefreshNotice";
import type { AppHistoryEntry, AppView } from "./app/navigation";
import type { GameDetailTeam } from "./domain/game";
import type { LeagueId } from "./plugins/registry";
import type { NormalizedPlayEvent } from "./domain/playByPlay";

type HomeAway = "away" | "home";

interface ScoreboardEvent extends Record<string, unknown> {
  id?: string | number;
  date?: string;
}

interface TeamChoice extends Partial<GameDetailTeam> {
  abbreviation?: string;
}

function asObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getFirstGameCompetition(game: unknown): unknown {
  return asArray(asObject(game).competitions)[0];
}

function getFirstSummaryCompetition(raw: unknown): unknown {
  const header = asObject(asObject(raw).header);
  return asArray(header.competitions)[0];
}

interface TimelineGroup {
  label: string;
  events: NormalizedPlayEvent[];
}

export default {
  setup() {
    const isNativeApp = isTauri();
    const preferences = ref(loadPreferences());
    const orderedLeagues = computed(() =>
      preferences.value.leagueOrder
        .map(getLeague)
        .filter((league): league is NonNullable<typeof league> => league !== null),
    );
    const visibleLeagues = computed(() =>
      orderedLeagues.value.filter((league) =>
        preferences.value.visibleLeagues.includes(league.id),
      ),
    );
    const firstVisibleLeague = (): LeagueId => visibleLeagues.value[0]?.id || LEAGUES[0].id;
    const selectedLeague = ref<LeagueId>(firstVisibleLeague());
    const leagueBehavior = computed(() => resolveLeague(selectedLeague.value));
    const seasonType = ref(2);
    const week = ref(1);
    const selectedGroup = ref("80");
    const selectedDate = ref(new Date().toLocaleDateString("en-CA"));
    const mlbStatGroup = ref("batting");
    const isDateLeague = computed(() => leagueBehavior.value?.schedule.mode === "date");
    const viewMode = ref<AppView>("scoreboard");
    const {
      standings,
      standingsLoading,
      standingsError,
      fetchStandings,
      resetStandings,
      getStandingStat,
      getStandingSortDirection,
      toggleStandingsSort,
      getSortedStandingTeams,
    } = useStandings(selectedLeague);
    const visibleStandings = computed(() =>
      filterStandingGroups(standings.value, selectedLeague.value, selectedGroup.value),
    );
    const showModal = ref(false);
    const selectedGame = ref<ScoreboardEvent | null>(null);
    const modalTab = ref("timeline");
    const showScoringOnly = ref(false);
    const selectedBoxScoreSide = ref("away");
    const modalView = ref<"game" | "team">("game");
    const selectedTeamSide = ref<HomeAway | null>(null);
    const selectedTeamOverride = ref<TeamChoice | null>(null);
    const showSeasonMetrics = ref(false);
    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    const {
      modalLoading,
      modalData,
      modalGameStatus,
      refreshing: summaryRefreshing,
      refreshFailed: summaryRefreshFailed,
      lastSuccessfulRefreshAt: lastSuccessfulSummaryRefreshAt,
      matchupSchedules,
      matchupLoading,
      fetchGameDetail,
      invalidateGameDetails,
      resetMatchupSchedules,
    } = useGameDetails({
      selectedLeague,
      showModal,
      modalView,
      selectedGame,
      modalTab,
    });
    const {
      teamData: rawTeamData,
      teamScheduleData,
      teamLoading,
      teamError,
      scheduleError,
      loadTeamDetails,
      resetTeamDetails,
    } = useTeamDetails({ selectedLeague, showModal });
    const teamData = computed(() => normalizeTeamDetails(rawTeamData.value));

    const {
      hasSavedNavigation,
      initialNavigationEntry,
      pushNavigationEntry,
      replaceCurrentNavigationEntry,
    } = useAppNavigation(
      { selectedLeague, viewMode, week, seasonType, selectedGroup, selectedDate },
      preferences.value.visibleLeagues,
      firstVisibleLeague(),
    );
    const {
      games,
      loading,
      refreshing: scoreboardRefreshing,
      refreshFailed: scoreboardRefreshFailed,
      lastSuccessfulRefreshAt,
      fetchScoreboard,
      invalidateScoreboard,
    } = useScoreboard(
      { selectedLeague, selectedDate, week, seasonType, selectedGroup, isDateLeague },
      replaceCurrentNavigationEntry,
    );
    const hasLiveScoreboardGame = computed(() =>
      games.value.some((game) => getGameStateUtil(game) === "in"),
    );
    const scoreboardRefreshStale = useRefreshNotice(
      lastSuccessfulRefreshAt,
      hasLiveScoreboardGame,
    );
    const summaryRefreshStale = useRefreshNotice(
      lastSuccessfulSummaryRefreshAt,
      computed(() =>
        showModal.value &&
        modalView.value === "game" &&
        modalGameStatus.value === "in",
      ),
    );
    const hasOpenGameModal = computed(() =>
      showModal.value && modalView.value === "game",
    );
    const refreshIndicatorActive = computed(() =>
      scoreboardRefreshing.value ||
      (hasOpenGameModal.value && summaryRefreshing.value),
    );
    const refreshIndicatorFailed = computed(() =>
      scoreboardRefreshFailed.value ||
      (hasOpenGameModal.value && summaryRefreshFailed.value),
    );
    const {
      settingsOpen,
      favoriteLeague,
      favoriteSearch,
      selectedFavoriteTeams,
      favoriteTeamIds,
      filteredTeamOptions,
      teamOptionsByLeague,
      teamOptionsLoading,
      teamOptionsError,
      loadFavoriteTeamOptions,
      handleFavoriteLeagueChange,
      openSettings,
      closeSettings,
      setAutoCheckForUpdates,
      setLeagueVisibility: updateLeagueVisibility,
      moveLeagueInOrder,
      toggleFavorite,
      isFavoriteTeam,
    } = usePreferences(preferences, selectedLeague);
    const {
      update,
      checking: updateChecking,
      checked: updateChecked,
      error: updateError,
      noticeDismissed: updateNoticeDismissed,
      checkForUpdates,
      openUpdateDownload,
      dismissUpdateNotice,
    } = useAppUpdates(preferences);

    const handleGameClick = (game: ScoreboardEvent) => openModal(game);

    const setLeagueVisibility = (leagueId: LeagueId, visible: boolean) => {
      const nextLeague = updateLeagueVisibility(leagueId, visible);
      if (nextLeague) switchTab(nextLeague);
    };
    const setDashboardView = async (view: AppView) => {
      if (viewMode.value === view) return;
      viewMode.value = view;
      pushNavigationEntry();
      if (view === "standings") await fetchStandings();
    };
    const handleGroupChange = () => {
      pushNavigationEntry();
      if (viewMode.value !== "standings") triggerImmediateFetch();
    };
    const handleDateChange = () => {
      pushNavigationEntry();
      triggerImmediateFetch();
    };
    const modalSeriesSummary = computed(() => {
      const summaryCompetition = getFirstSummaryCompetition(modalData.value?.raw);
      return (
        getSeriesSummary(summaryCompetition) ||
        getSeriesSummary(getFirstGameCompetition(selectedGame.value))
      );
    });
    const selectedTeam = computed<TeamChoice>(() => {
      const side = selectedTeamSide.value;
      return selectedTeamOverride.value ||
        (side ? modalData.value?.teams[side] : undefined) || {};
    });
    const teamRecordStats = computed(() => getTeamRecordStats(rawTeamData.value));
    const teamRecords = computed(() => getTeamRecords(rawTeamData.value));
    const teamSchedule = computed(() => {
      const teamId = selectedTeam.value.id;
      if (!teamId) return [];
      return normalizeSchedule(teamScheduleData.value, teamId, "en-US");
    });

    const resetTeamView = () => {
      modalView.value = "game";
      selectedTeamSide.value = null;
      selectedTeamOverride.value = null;
      resetTeamDetails();
      showSeasonMetrics.value = false;
    };

    const openTeamDetails = async (
      teamOrSide: TeamChoice | HomeAway,
      { pushHistory = true }: { pushHistory?: boolean } = {},
    ) => {
      const isTeamSide = teamOrSide === "away" || teamOrSide === "home";
      const team: TeamChoice | undefined = isTeamSide
        ? modalData.value?.teams[teamOrSide]
        : teamOrSide;
      if (!team?.id) return;
      if (isTeamSide) {
        selectedTeamSide.value = teamOrSide;
        selectedTeamOverride.value = null;
      } else {
        selectedTeamSide.value = null;
        selectedTeamOverride.value = team;
        selectedGame.value = null;
        modalData.value = null;
        modalLoading.value = false;
        showModal.value = true;
      }
      modalView.value = "team";
      if (pushHistory) {
        pushNavigationEntry({
          type: "team",
          teamId: String(team.id),
          team: {
            id: String(team.id),
            name: team.name || team.abbrev || team.abbreviation || "Team",
            abbrev: team.abbrev || team.abbreviation || "",
            logo: team.logo || "",
          },
          source: isTeamSide ? "game" : "standings",
          ...(isTeamSide
            ? {
                gameId: String(
                  modalData.value?.id || selectedGame.value?.id || "",
                ),
                side: teamOrSide as HomeAway,
              }
            : {}),
        });
      }
      await loadTeamDetails(team.id);
    };

    const returnToGame = () => {
      const currentEntry = readAppHistoryEntry(window.history.state);
      if (
        currentEntry?.snapshot.modal?.type === "team" &&
        canGoBackWithinApp(currentEntry) &&
        currentEntry.index >
          (currentEntry.modalBaseIndex ?? currentEntry.rootIndex)
      ) {
        window.history.back();
        return;
      }
      if (modalData.value) {
        modalView.value = "game";
        replaceCurrentNavigationEntry({
          type: "game",
          eventId: String(modalData.value.id),
        });
      } else {
        closeModal();
      }
    };
    const openModal = (
      game: ScoreboardEvent,
      { pushHistory = true }: { pushHistory?: boolean } = {},
    ) => {
      showModal.value = true;
      selectedGame.value = game;
      resetTeamView();
      modalData.value = null;
      modalTab.value = getGameState(game) === "pre" ? "matchup" : "stats";
      showScoringOnly.value = false;
      selectedBoxScoreSide.value = "away";
      resetMatchupSchedules();
      if (pushHistory) {
        pushNavigationEntry({ type: "game", eventId: String(game.id) });
      }
      fetchGameDetail(String(game.id ?? ""));
    };

    const closeModal = () => {
      const currentEntry = readAppHistoryEntry(window.history.state);
      if (currentEntry?.snapshot.modal) {
        const modalBaseIndex =
          currentEntry.modalBaseIndex ?? currentEntry.rootIndex;
        const historySteps = modalBaseIndex - currentEntry.index;
        if (historySteps < 0) {
          window.history.go(historySteps);
          return;
        }
      }
      showModal.value = false;
      modalData.value = null;
      selectedGame.value = null;
      invalidateGameDetails();
      resetTeamView();
      replaceCurrentNavigationEntry(null);
    };

    const restoreNavigationEntry = async (
      entry: AppHistoryEntry,
      isInitialLoad = false,
    ) => {
      let snapshot = reconcileAppSnapshot(
        entry.snapshot,
        preferences.value.visibleLeagues,
        firstVisibleLeague(),
      );
      if (snapshot !== entry.snapshot) {
        replaceAppHistoryEntry(window.history, snapshot);
      }
      invalidateScoreboard();
      resetStandings();
      invalidateGameDetails();
      resetTeamDetails();
      selectedLeague.value = snapshot.league;
      viewMode.value = snapshot.view;
      week.value = snapshot.week;
      seasonType.value = snapshot.seasonType;
      selectedGroup.value = snapshot.selectedGroup;
      selectedDate.value = snapshot.selectedDate;
      modalData.value = null;
      selectedGame.value = null;
      selectedTeamSide.value = null;
      selectedTeamOverride.value = null;
      modalLoading.value = false;
      showSeasonMetrics.value = false;
      showModal.value = false;
      modalView.value = "game";

      const pendingRequests = [
        fetchScoreboard(isInitialLoad && !hasSavedNavigation, isInitialLoad),
      ];
      if (snapshot.view === "standings") pendingRequests.push(fetchStandings());
      if (snapshot.modal?.type === "game") {
        openModal({ id: snapshot.modal.eventId }, { pushHistory: false });
      } else if (snapshot.modal?.type === "team") {
        const team = snapshot.modal.team || {
          id: snapshot.modal.teamId,
          name: "Team",
        };
        openTeamDetails(team, { pushHistory: false });
      }
      await Promise.all(pendingRequests);
    };

    const handlePopState = (event: PopStateEvent) => {
      const entry = readAppHistoryEntry(event.state);
      if (entry) restoreNavigationEntry(entry);
    };

    const linescoreHeaders = computed(() => {
      const rawCompetition = getFirstSummaryCompetition(modalData.value?.raw);
      if (!rawCompetition) return [];
      const competition = asObject(rawCompetition);
      const competitors = asArray(competition.competitors).map(asObject);
      const awayLines = asArray(competitors[0]?.linescores);
      const homeLines = asArray(competitors[1]?.linescores);

      return getLinescoreHeadersUtil(
        selectedLeague.value,
        awayLines,
        homeLines,
      );
    });

    const linescores = computed(() => {
      const competition = getFirstSummaryCompetition(modalData.value?.raw);
      if (!competition) return { away: [], home: [] };
      return getLinescoreValuesUtil(competition, linescoreHeaders.value.length);
    });

    const modalTabs = computed(() => modalGameStatus.value === "pre"
      ? [
          { id: "matchup", label: "MATCHUP" },
          { id: "stats", label: "TEAM STATS" },
        ]
      : [
          { id: "stats", label: "TEAM STATS" },
          { id: "flow", label: "FLOW" },
          { id: "timeline", label: "TIMELINE" },
          { id: "boxscore", label: "BOX SCORE" },
          { id: "matchup", label: "MATCHUP" },
        ]);
    const pregameMatchup = computed(() =>
      normalizeMatchup(modalData.value?.raw, matchupSchedules.value),
    );
    const playTimeline = computed(() =>
      normalizePlayByPlay(modalData.value?.raw, selectedLeague.value),
    );
    const visibleTimelineEvents = computed(() =>
      showScoringOnly.value
        ? playTimeline.value.events.filter((event) => event.scoring)
        : playTimeline.value.events,
    );
    const timelineGroups = computed(() => {
      const groups: TimelineGroup[] = [];
      for (const event of visibleTimelineEvents.value) {
        const label = event.periodLabel || "Game";
        let group = groups.find((entry): entry is TimelineGroup => entry.label === label);
        if (!group) {
          group = { label, events: [] };
          groups.push(group);
        }
        group.events.push(event);
      }
      return groups;
    });
    const gameFlow = computed(() =>
      buildGameFlow(playTimeline.value, modalData.value?.teams),
    );
    const formatRecentGameDate = (value: unknown) => {
      if (
        typeof value !== "string" && typeof value !== "number" &&
        !(value instanceof Date)
      ) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }).format(date);
    };
    const formatMatchupDate = (value: unknown) => {
      if (
        typeof value !== "string" && typeof value !== "number" &&
        !(value instanceof Date)
      ) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date);
    };

    const currentDrive = computed(() => {
      if (!leagueBehavior.value?.game.supportsDrives) {
        return null;
      }
      const dr = asObject(asObject(modalData.value?.drives).current);
      if (Object.keys(dr).length === 0) return null;
      return {
        description: dr.description || "Active drive ongoing...",
        result: dr.result || "Ongoing",
        recap: asObject(dr.recap).recap || "",
      };
    });

    const winProbabilityChart = computed(() =>
      getWinProbabilityChartUtil(modalData.value?.winprobability),
    );

    const teamStats = computed(() => {
      if (!modalData.value || !modalData.value.teams) return [];

      const awayStats = modalData.value.teams.away?.statistics || [];
      const homeStats = modalData.value.teams.home?.statistics || [];

      if (leagueBehavior.value?.game.teamStatsMode === "grouped") {
        const rawBox = asArray(asObject(asObject(modalData.value.raw).boxscore).teams);
        return getBaseballTeamStatComparisonsUtil(rawBox, mlbStatGroup.value);
      }

      return getTeamStatComparisonsUtil(awayStats, homeStats);
    });

    const gameFlowColors = computed(() =>
      getGameFlowColorsUtil(modalData.value?.teams),
    );
    const teamStatBarColors = gameFlowColors;

    const playerBoxScore = computed(() =>
      getPlayerBoxScoreUtil(modalData.value, selectedLeague.value),
    );

    const triggerImmediateFetch = async () => {
      if (pollingInterval !== null) clearInterval(pollingInterval);
      await fetchScoreboard(false);
      startPoller();
    };

    const startPoller = () => {
      if (pollingInterval !== null) clearInterval(pollingInterval);
      pollingInterval = setInterval(() => {
        fetchScoreboard(false);
        if (
          showModal.value &&
          modalView.value === "game" &&
          modalData.value?.id
        ) {
          fetchGameDetail(modalData.value.id);
        }
      }, 15000);
    };

    const switchTab = async (league: LeagueId) => {
      if (!preferences.value.visibleLeagues.includes(league)) return;
      if (selectedLeague.value === league) return;
      resetTeamView();
      selectedLeague.value = league;
      resetStandings();
      selectedGroup.value = "80";
      if (resolveLeague(league)?.schedule.mode === "date") {
        selectedDate.value = new Date().toLocaleDateString("en-CA");
      }
      pushNavigationEntry();
      if (pollingInterval !== null) clearInterval(pollingInterval);
      await fetchScoreboard(true);
      startPoller();
      if (viewMode.value === "standings") await fetchStandings();
    };

    const adjustWeek = (amount: number) => {
      if (week.value + amount < 1) return;
      week.value += amount;
      pushNavigationEntry();
      triggerImmediateFetch();
    };

    const setSeasonType = (type: number) => {
      if (seasonType.value === type && week.value === 1) return;
      seasonType.value = type;
      week.value = 1;
      pushNavigationEntry();
      triggerImmediateFetch();
    };

    const sortedGames = computed(() =>
      sortGamesUtil(games.value, selectedLeague.value),
    );
    const tvLineup = computed(() =>
      getTvLineupLayoutUtil(
        sortedGames.value,
        selectedLeague.value,
        seasonType.value,
        isDateLeague.value
          ? selectedDate.value
          : new Date().toLocaleDateString("en-CA"),
      ),
    );
    const tvLineupScrollLeft = ref(0);
    const handleTvLineupScroll = (event: Event) => {
      if (event.currentTarget instanceof HTMLElement) {
        tvLineupScrollLeft.value = event.currentTarget.scrollLeft;
      }
    };

    const isTeamHighlighted = (game: ScoreboardEvent, homeAway: HomeAway) =>
      isTeamHighlightedUtil(
        getCompetitorUtil(game, homeAway)?.id,
        favoriteTeamIds.value,
      );

    const isGameHighlighted = (game: ScoreboardEvent) =>
      isGameHighlightedUtil(game, favoriteTeamIds.value);

    const getSituation = (game: ScoreboardEvent) => getSituationUtil(game, selectedLeague.value);
    const hasPossession = (game: ScoreboardEvent | undefined, homeAway: HomeAway) =>
      hasPossessionUtil(game, homeAway, selectedLeague.value);

    const isWinner = (game: ScoreboardEvent, type: HomeAway) => isWinnerUtil(game, type);
    const getGameState = (game: ScoreboardEvent | null) => getGameStateUtil(game);
    const getSeriesSummary = (competition: unknown) => getSeriesSummaryUtil(competition);
    const getNetwork = (game: ScoreboardEvent) => getNetworkUtil(game);
    const formatGameTime = (game: ScoreboardEvent) => formatGameTimeUtil(game);
    const getTeamName = (game: ScoreboardEvent, type: HomeAway) => getTeamNameUtil(game, type);
    const getTeamLogo = (game: ScoreboardEvent, type: HomeAway) => getTeamLogoUtil(game, type);
    const getTeamScore = (game: ScoreboardEvent, type: HomeAway) => getTeamScoreUtil(game, type);
    const getTeamRank = (game: ScoreboardEvent, type: HomeAway) => getTeamRankUtil(game, type);
    const getTvLineupTeamStyle = (game: ScoreboardEvent, type: HomeAway) =>
      getTvLineupTeamStyleUtil(game, type);

    onMounted(async () => {
      window.addEventListener("popstate", handlePopState);
      await restoreNavigationEntry(initialNavigationEntry, !hasSavedNavigation);
      startPoller();
      void checkForUpdates(true);
    });

    return {
      isNativeApp,
      LEAGUES,
      preferences,
      orderedLeagues,
      visibleLeagues,
      settingsOpen,
      openSettings,
      closeSettings,
      setAutoCheckForUpdates,
      update,
      updateChecking,
      updateChecked,
      updateError,
      updateNoticeDismissed,
      checkForUpdates,
      openUpdateDownload,
      dismissUpdateNotice,
      setLeagueVisibility,
      moveLeagueInOrder,
      favoriteLeague,
      handleFavoriteLeagueChange,
      selectedFavoriteTeams,
      favoriteSearch,
      filteredTeamOptions,
      teamOptionsByLeague,
      teamOptionsLoading,
      teamOptionsError,
      loadFavoriteTeamOptions,
      toggleFavorite,
      isFavoriteTeam,
      selectedLeague,
      leagueBehavior,
      seasonType,
      week,
      selectedGroup,
      selectedDate,
      mlbStatGroup,
      isDateLeague,
      games,
      loading,
      lastSuccessfulRefreshAt,
      lastSuccessfulSummaryRefreshAt,
      scoreboardRefreshStale,
      summaryRefreshStale,
      refreshIndicatorActive,
      refreshIndicatorFailed,
      formatLastUpdatedAt: formatLastUpdatedAtUtil,
      viewMode,
      standings,
      visibleStandings,
      standingsLoading,
      standingsError,
      setDashboardView,
      getStandingStat,
      getStandingSortDirection,
      toggleStandingsSort,
      getSortedStandingTeams,
      showModal,
      modalLoading,
      modalData,
      modalTab,
      modalGameStatus,
      modalTabs,
      pregameMatchup,
      matchupLoading,
      selectedBoxScoreSide,
      playTimeline,
      showScoringOnly,
      timelineGroups,
      gameFlow,
      gameFlowColors,
      formatRecentGameDate,
      formatMatchupDate,
      modalView,
      selectedTeamSide,
      selectedTeam,
      teamData,
      teamLoading,
      teamError,
      scheduleError,
      showSeasonMetrics,
      teamRecords,
      teamRecordStats,
      teamSchedule,
      sortedGames,
      tvLineup,
      tvLineupScrollLeft,
      handleTvLineupScroll,
      linescoreHeaders,
      linescores,
      currentDrive,
      winProbabilityChart,
      teamStats,
      teamStatBarColors,
      playerBoxScore,
      switchTab,
      adjustWeek,
      setSeasonType,
      triggerImmediateFetch,
      handleGroupChange,
      handleDateChange,
      openModal,
      openTeamDetails,
      returnToGame,
      closeModal,
      getGameState,
      getSeriesSummary,
      modalSeriesSummary,
      getSituation,
      hasPossession,
      getNetwork,
      formatGameTime,
      getTeamName,
      getTeamLogo,
      getTeamScore,
      getTeamRank,
      getTvLineupTeamStyle,
      isWinner,
      isTeamHighlighted,
      isGameHighlighted,
      handleGameClick,
    };
  },
};
</script>
