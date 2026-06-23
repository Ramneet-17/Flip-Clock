/* ============================================
   FLIP CLOCK — Core Logic
   ============================================ */

(function () {
  'use strict';

  // ---- STATE ----
  const state = {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, // default: system timezone
    is24h: false,
    showSeconds: true,
    showDate: true,
    darkMode: true,
    previousDigits: { hourTens: '', hourOnes: '', minTens: '', minOnes: '', secTens: '', secOnes: '' }
  };

  // ---- ELEMENTS ----
  const cards = {
    hourTens: document.getElementById('hourTens'),
    hourOnes: document.getElementById('hourOnes'),
    minTens: document.getElementById('minTens'),
    minOnes: document.getElementById('minOnes'),
    secTens: document.getElementById('secTens'),
    secOnes: document.getElementById('secOnes')
  };

  const els = {
    ampmIndicator: document.getElementById('ampmIndicator'),
    dateDisplay: document.getElementById('dateDisplay'),
    timezoneDisplay: document.getElementById('timezoneDisplay'),
    clockContainer: document.getElementById('clockContainer'),
    settingsOverlay: document.getElementById('settingsOverlay'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsClose: document.getElementById('settingsClose'),
    quitBtn: document.getElementById('quitBtn'),
    formatToggle: document.getElementById('formatToggle'),
    secondsToggle: document.getElementById('secondsToggle'),
    timezoneSearch: document.getElementById('timezoneSearch'),
    timezoneDropdown: document.getElementById('timezoneDropdown'),
    currentTimezone: document.getElementById('currentTimezone'),
    appContainer: document.getElementById('appContainer')
  };

  // ---- TIMEZONE LIST ----
  const ALL_TIMEZONES = Intl.supportedValuesOf
    ? Intl.supportedValuesOf('timeZone')
    : [
        'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
        'America/Toronto', 'America/Vancouver', 'America/Mexico_City', 'America/Sao_Paulo',
        'America/Argentina/Buenos_Aires', 'America/Bogota', 'America/Lima',
        'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome',
        'Europe/Madrid', 'Europe/Amsterdam', 'Europe/Moscow', 'Europe/Istanbul',
        'Asia/Dubai', 'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Tokyo',
        'Asia/Seoul', 'Asia/Singapore', 'Asia/Hong_Kong', 'Asia/Bangkok',
        'Asia/Jakarta', 'Asia/Karachi', 'Asia/Dhaka',
        'Australia/Sydney', 'Australia/Melbourne', 'Australia/Perth',
        'Pacific/Auckland', 'Pacific/Honolulu', 'Pacific/Fiji',
        'Africa/Cairo', 'Africa/Lagos', 'Africa/Nairobi', 'Africa/Johannesburg',
        'UTC'
      ];

  // ---- LOAD SETTINGS ----
  function loadSettings() {
    try {
      const saved = localStorage.getItem('flipClockSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.timezone) state.timezone = parsed.timezone;
        if (typeof parsed.is24h === 'boolean') state.is24h = parsed.is24h;
        if (typeof parsed.showSeconds === 'boolean') state.showSeconds = parsed.showSeconds;
        if (typeof parsed.showDate === 'boolean') state.showDate = parsed.showDate;
        if (typeof parsed.darkMode === 'boolean') state.darkMode = parsed.darkMode;
      }
    } catch (e) {
      console.warn('Could not load settings:', e);
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem('flipClockSettings', JSON.stringify({
        timezone: state.timezone,
        is24h: state.is24h,
        showSeconds: state.showSeconds,
        showDate: state.showDate,
        darkMode: state.darkMode
      }));
    } catch (e) {
      console.warn('Could not save settings:', e);
    }
  }

  // ---- TIME LOGIC ----
  function getTimeInTimezone() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: state.timezone,
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const parts = formatter.formatToParts(now);
    let hours = 0, minutes = 0, seconds = 0, dayPeriod = '';

    for (const part of parts) {
      if (part.type === 'hour') hours = parseInt(part.value, 10);
      if (part.type === 'minute') minutes = parseInt(part.value, 10);
      if (part.type === 'second') seconds = parseInt(part.value, 10);
      if (part.type === 'dayPeriod') dayPeriod = part.value.toUpperCase();
    }

    // Convert to 24h if needed
    let hours24 = hours;
    if (dayPeriod === 'PM' && hours !== 12) hours24 = hours + 12;
    if (dayPeriod === 'AM' && hours === 12) hours24 = 0;

    let displayHours;
    if (state.is24h) {
      displayHours = hours24;
    } else {
      displayHours = hours;
    }

    return { hours: displayHours, minutes, seconds, dayPeriod, hours24 };
  }

  function getDateInTimezone() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: state.timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    return formatter.format(now);
  }

  function getTimezoneAbbreviation() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: state.timezone,
      timeZoneName: 'short'
    });
    const parts = formatter.formatToParts(now);
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    return tzPart ? tzPart.value : '';
  }

  // ---- FLIP ANIMATION ----
  function setCardDigit(card, newDigit, cardKey) {
    const oldDigit = state.previousDigits[cardKey];

    if (oldDigit === newDigit) return; // no change

    const topDigit = card.querySelector('.card-top .digit');
    const bottomDigit = card.querySelector('.card-bottom .digit');
    const flapTopDigit = card.querySelector('.card-flap-top .digit');
    const flapBottomDigit = card.querySelector('.card-flap-bottom .digit');

    // Remove any ongoing animation
    card.classList.remove('flipping');

    // Correct flip sequence:
    // 1. card-flap-top shows OLD digit — it sits on top and will flip away
    // 2. card-top (underneath flap-top) shows NEW digit — revealed as flap flips down
    // 3. card-bottom stays as OLD digit — visible until flap-bottom covers it
    // 4. card-flap-bottom shows NEW digit — flips from hidden (90deg) into view

    flapTopDigit.textContent = oldDigit || newDigit;
    topDigit.textContent = newDigit;
    // card-bottom keeps its current OLD value (don't touch it yet)
    flapBottomDigit.textContent = newDigit;

    // Force reflow to restart animations
    void card.offsetWidth;

    // Trigger animation
    card.classList.add('flipping');

    // After animation completes, sync all faces to new digit
    setTimeout(() => {
      card.classList.remove('flipping');
      bottomDigit.textContent = newDigit;
      flapTopDigit.textContent = newDigit;
    }, 550); // match total animation duration

    state.previousDigits[cardKey] = newDigit;
  }

  function pad2(n) {
    return n.toString().padStart(2, '0');
  }

  // ---- UPDATE CLOCK ----
  function updateClock() {
    const time = getTimeInTimezone();

    const h = pad2(time.hours);
    const m = pad2(time.minutes);
    const s = pad2(time.seconds);

    setCardDigit(cards.hourTens, h[0], 'hourTens');
    setCardDigit(cards.hourOnes, h[1], 'hourOnes');
    setCardDigit(cards.minTens, m[0], 'minTens');
    setCardDigit(cards.minOnes, m[1], 'minOnes');
    setCardDigit(cards.secTens, s[0], 'secTens');
    setCardDigit(cards.secOnes, s[1], 'secOnes');

    // AM/PM
    if (!state.is24h) {
      els.ampmIndicator.textContent = time.dayPeriod;
    } else {
      els.ampmIndicator.textContent = '';
    }

    // Date
    els.dateDisplay.textContent = getDateInTimezone();

    // Timezone
    const abbr = getTimezoneAbbreviation();
    const label = state.timezone.replace(/_/g, ' ').replace(/\//g, ' / ');
    els.timezoneDisplay.textContent = `${abbr} — ${label}`;
  }

  // ---- SETTINGS UI ----
  function openSettings() {
    els.settingsOverlay.classList.add('open');
    updateSettingsUI();
  }

  function closeSettings() {
    els.settingsOverlay.classList.remove('open');
    els.timezoneDropdown.classList.remove('open');
  }

  function updateSettingsUI() {
    // Format toggle
    if (state.is24h) {
      els.formatToggle.classList.add('active');
    } else {
      els.formatToggle.classList.remove('active');
    }

    // Seconds toggle
    if (state.showSeconds) {
      els.secondsToggle.classList.add('active');
    } else {
      els.secondsToggle.classList.remove('active');
    }

    // Date toggle
    const dateToggle = document.getElementById('dateToggle');
    if (dateToggle) {
      if (state.showDate) {
        dateToggle.classList.add('active');
      } else {
        dateToggle.classList.remove('active');
      }
    }

    // Dark mode toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
      if (state.darkMode) {
        darkModeToggle.classList.add('active');
      } else {
        darkModeToggle.classList.remove('active');
      }
    }

    // Current timezone display
    els.currentTimezone.textContent = `Current: ${state.timezone.replace(/_/g, ' ')}`;

    // Apply seconds visibility
    if (state.showSeconds) {
      els.clockContainer.classList.remove('hide-seconds');
    } else {
      els.clockContainer.classList.add('hide-seconds');
    }

    // Apply date visibility
    els.dateDisplay.style.display = state.showDate ? '' : 'none';

    // Apply dark/light mode
    if (state.darkMode) {
      els.appContainer.removeAttribute('data-mode');
    } else {
      els.appContainer.setAttribute('data-mode', 'light');
    }
  }

  function populateTimezoneDropdown(filter = '') {
    const dropdown = els.timezoneDropdown;
    dropdown.innerHTML = '';

    const filtered = ALL_TIMEZONES.filter(tz =>
      tz.toLowerCase().includes(filter.toLowerCase())
    );

    const maxShow = 50;
    const toShow = filtered.slice(0, maxShow);

    for (const tz of toShow) {
      const option = document.createElement('div');
      option.className = 'timezone-option';
      if (tz === state.timezone) option.classList.add('selected');
      option.textContent = tz.replace(/_/g, ' ');
      option.addEventListener('click', () => {
        state.timezone = tz;
        saveSettings();
        updateSettingsUI();
        updateClock();
        dropdown.classList.remove('open');
        els.timezoneSearch.value = '';
      });
      dropdown.appendChild(option);
    }

    if (toShow.length > 0) {
      dropdown.classList.add('open');
    } else {
      dropdown.classList.remove('open');
    }
  }

  // ---- EVENT LISTENERS ----
  function initEvents() {
    // Settings open/close
    els.settingsBtn.addEventListener('click', openSettings);
    els.settingsClose.addEventListener('click', closeSettings);

    // Quit button
    els.quitBtn.addEventListener('click', () => {
      window.close();
    });

    // Click outside settings panel to close
    els.settingsOverlay.addEventListener('click', (e) => {
      if (e.target === els.settingsOverlay) closeSettings();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 's' || e.key === 'S') {
        if (!els.settingsOverlay.classList.contains('open') && e.target.tagName !== 'INPUT') {
          e.preventDefault();
          openSettings();
        }
      }
      if (e.key === 'Escape') {
        closeSettings();
      }
    });

    // Format toggle (12h/24h)
    els.formatToggle.addEventListener('click', () => {
      state.is24h = !state.is24h;
      // Reset previous digits to force re-render
      Object.keys(state.previousDigits).forEach(k => state.previousDigits[k] = '');
      saveSettings();
      updateSettingsUI();
      updateClock();
    });

    // Seconds toggle
    els.secondsToggle.addEventListener('click', () => {
      state.showSeconds = !state.showSeconds;
      saveSettings();
      updateSettingsUI();
    });

    // Date toggle
    const dateToggle = document.getElementById('dateToggle');
    if (dateToggle) {
      dateToggle.addEventListener('click', () => {
        state.showDate = !state.showDate;
        saveSettings();
        updateSettingsUI();
      });
    }

    // Timezone search
    els.timezoneSearch.addEventListener('input', (e) => {
      populateTimezoneDropdown(e.target.value);
    });

    els.timezoneSearch.addEventListener('focus', () => {
      populateTimezoneDropdown(els.timezoneSearch.value);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!els.timezoneSearch.contains(e.target) && !els.timezoneDropdown.contains(e.target)) {
        els.timezoneDropdown.classList.remove('open');
      }
    });

    // Dark mode toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
      darkModeToggle.addEventListener('click', () => {
        state.darkMode = !state.darkMode;
        saveSettings();
        updateSettingsUI();
      });
    }
  }

  // ---- INIT ----
  function init() {
    loadSettings();
    initEvents();
    updateSettingsUI();

    // Initial render — set all digits immediately (no animation first time)
    const time = getTimeInTimezone();
    const h = pad2(time.hours);
    const m = pad2(time.minutes);
    const s = pad2(time.seconds);

    const setStatic = (card, digit, key) => {
      card.querySelector('.card-top .digit').textContent = digit;
      card.querySelector('.card-bottom .digit').textContent = digit;
      card.querySelector('.card-flap-top .digit').textContent = digit;
      card.querySelector('.card-flap-bottom .digit').textContent = digit;
      state.previousDigits[key] = digit;
    };

    setStatic(cards.hourTens, h[0], 'hourTens');
    setStatic(cards.hourOnes, h[1], 'hourOnes');
    setStatic(cards.minTens, m[0], 'minTens');
    setStatic(cards.minOnes, m[1], 'minOnes');
    setStatic(cards.secTens, s[0], 'secTens');
    setStatic(cards.secOnes, s[1], 'secOnes');

    // AM/PM
    if (!state.is24h) {
      els.ampmIndicator.textContent = time.dayPeriod;
    }

    els.dateDisplay.textContent = getDateInTimezone();
    const abbr = getTimezoneAbbreviation();
    const label = state.timezone.replace(/_/g, ' ').replace(/\//g, ' / ');
    els.timezoneDisplay.textContent = `${abbr} — ${label}`;

    // Start the clock — sync to the next second boundary for accuracy
    const now = new Date();
    const msToNextSecond = 1000 - now.getMilliseconds();

    setTimeout(() => {
      updateClock();
      setInterval(updateClock, 1000);
    }, msToNextSecond);
  }

  // Start everything
  init();
})();
