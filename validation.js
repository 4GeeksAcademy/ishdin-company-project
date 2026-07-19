/**
 * TrackFlow — Request Information form validation
 * Plain vanilla JavaScript, no build step, no framework.
 * Runs entirely in the browser against application.html.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('requestForm');
    if (!form) return;

    var successPanel = document.getElementById('successPanel');

    var MAX_COMMENTS = 500;
    var comments = document.getElementById('comments');
    var commentsCounter = document.getElementById('comments-counter');
    var commentsError = document.getElementById('comments-error');

    var volumeSelect = document.getElementById('volume');
    var productTypeSelect = document.getElementById('productType');
    var volumeWarning = document.getElementById('volumeWarning');

    // ---- Simple field validators -----------------------------------
    // Each entry: input element, its error <p>, a validate(value) fn,
    // and the exact error message to show when validate() fails.
    var fields = [
      {
        input: document.getElementById('companyName'),
        error: document.getElementById('companyName-error'),
        validate: function (v) {
          return v.trim().length >= 2;
        },
        message: 'Company name must have at least 2 characters'
      },
      {
        input: document.getElementById('contactPerson'),
        error: document.getElementById('contactPerson-error'),
        validate: function (v) {
          var words = v.trim().split(/\s+/).filter(Boolean);
          return words.length >= 2;
        },
        message: 'Enter first and last name of contact'
      },
      {
        input: document.getElementById('corporateEmail'),
        error: document.getElementById('corporateEmail-error'),
        validate: function (v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
        },
        message: 'Enter a valid corporate email (example: name@company.com)'
      },
      {
        input: document.getElementById('phone'),
        error: document.getElementById('phone-error'),
        validate: function (v) {
          // must start with "+" then a country code and the rest of the number
          return /^\+\d{1,4}[\d\s-]{5,}$/.test(v.trim());
        },
        message: 'Phone must include country code (example: +1 213 555 0147)'
      },
      {
        input: document.getElementById('website'),
        error: document.getElementById('website-error'),
        required: false,
        validate: function (v) {
          var value = v.trim();
          if (value === '') return true; // optional field
          if (!/^https?:\/\//i.test(value)) return false;
          try {
            new URL(value);
            return true;
          } catch (e) {
            return false;
          }
        },
        message: 'If you include website, it must be a valid URL'
      },
      {
        input: document.getElementById('country'),
        error: document.getElementById('country-error'),
        validate: function (v) {
          return v !== '';
        },
        message: 'Select main operating country'
      },
      {
        input: productTypeSelect,
        error: document.getElementById('productType-error'),
        validate: function (v) {
          return v !== '';
        },
        message: 'Select the type of product you handle'
      },
      {
        input: volumeSelect,
        error: document.getElementById('volume-error'),
        validate: function (v) {
          return v !== '';
        },
        message: 'Select estimated monthly volume'
      }
    ];

    // ---- Helpers ------------------------------------------------------
    function showError(input, errorEl, message) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
      input.classList.remove('border-ink/20');
      input.classList.add('border-danger');
      input.setAttribute('aria-invalid', 'true');
    }

    function clearError(input, errorEl) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
      input.classList.remove('border-danger');
      input.classList.add('border-ink/20');
      input.setAttribute('aria-invalid', 'false');
    }

    function validateField(field) {
      var ok = field.validate(field.input.value);
      if (ok) {
        clearError(field.input, field.error);
      } else {
        showError(field.input, field.error, field.message);
      }
      return ok;
    }

    function showGroupError(groupEl, errorEl, message) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
      groupEl.classList.remove('border-ink/15');
      groupEl.classList.add('border-danger');
    }

    function clearGroupError(groupEl, errorEl) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
      groupEl.classList.remove('border-danger');
      groupEl.classList.add('border-ink/15');
    }

    // ---- Live validation on blur / change -----------------------------
    fields.forEach(function (field) {
      var evt = field.input.tagName === 'SELECT' ? 'change' : 'blur';
      field.input.addEventListener(evt, function () {
        validateField(field);
      });
    });

    // ---- Services of interest (checkbox group) -------------------------
    var servicesGroup = document.getElementById('servicesGroup');
    var servicesError = document.getElementById('services-error');
    var serviceInputs = form.querySelectorAll('input[name="services"]');

    function validateServices() {
      var anyChecked = Array.prototype.some.call(serviceInputs, function (el) {
        return el.checked;
      });
      if (anyChecked) {
        clearGroupError(servicesGroup, servicesError);
      } else {
        showGroupError(servicesGroup, servicesError, 'Select at least one service of interest');
      }
      return anyChecked;
    }

    serviceInputs.forEach(function (el) {
      el.addEventListener('change', validateServices);
    });

    // ---- Current 3PL (radio group) -------------------------------------
    var current3plGroup = document.getElementById('current3plGroup');
    var current3plError = document.getElementById('current3pl-error');
    var current3plInputs = form.querySelectorAll('input[name="current3pl"]');

    function validateCurrent3pl() {
      var anyChecked = Array.prototype.some.call(current3plInputs, function (el) {
        return el.checked;
      });
      if (anyChecked) {
        clearGroupError(current3plGroup, current3plError);
      } else {
        showGroupError(current3plGroup, current3plError, 'Indicate if you currently work with another logistics provider');
      }
      return anyChecked;
    }

    current3plInputs.forEach(function (el) {
      el.addEventListener('change', validateCurrent3pl);
    });

    // ---- Comments counter + 500 character limit -------------------------
    function updateCommentsCounter() {
      if (comments.value.length > MAX_COMMENTS) {
        comments.value = comments.value.slice(0, MAX_COMMENTS);
      }
      var remaining = MAX_COMMENTS - comments.value.length;

      if (remaining <= 0) {
        commentsCounter.classList.add('hidden');
        commentsError.textContent = 'Comments cannot exceed 500 characters (' + remaining + ' remaining)';
        commentsError.classList.remove('hidden');
        comments.classList.add('border-danger');
        comments.classList.remove('border-ink/20');
      } else {
        commentsError.classList.add('hidden');
        comments.classList.remove('border-danger');
        comments.classList.add('border-ink/20');
        commentsCounter.classList.remove('hidden');
        commentsCounter.textContent = remaining + ' characters remaining';
      }
    }

    comments.addEventListener('input', updateCommentsCounter);

    // ---- Volume / product type advisory warning --------------------------
    function checkVolumeWarning() {
      var isLowVolume = volumeSelect.value === '0-100';
      var hasProductType = productTypeSelect.value !== '';
      if (isLowVolume && hasProductType) {
        volumeWarning.classList.remove('hidden');
      } else {
        volumeWarning.classList.add('hidden');
      }
    }

    volumeSelect.addEventListener('change', checkVolumeWarning);
    productTypeSelect.addEventListener('change', checkVolumeWarning);

    // ---- Privacy policy checkbox -----------------------------------------
    var privacyInput = document.getElementById('privacyPolicy');
    var privacyError = document.getElementById('privacyPolicy-error');

    function validatePrivacy() {
      if (privacyInput.checked) {
        clearError(privacyInput, privacyError);
        return true;
      }
      showError(privacyInput, privacyError, 'You must accept the privacy policy to continue');
      return false;
    }

    privacyInput.addEventListener('change', validatePrivacy);

    // ---- Full form validation on submit -----------------------------------
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var isValid = true;
      var firstInvalid = null;

      fields.forEach(function (field) {
        var ok = validateField(field);
        if (!ok) {
          isValid = false;
          if (!firstInvalid) firstInvalid = field.input;
        }
      });

      var servicesOk = validateServices();
      if (!servicesOk) {
        isValid = false;
        if (!firstInvalid) firstInvalid = serviceInputs[0];
      }

      var current3plOk = validateCurrent3pl();
      if (!current3plOk) {
        isValid = false;
        if (!firstInvalid) firstInvalid = current3plInputs[0];
      }

      updateCommentsCounter();
      if (comments.value.length > MAX_COMMENTS) {
        isValid = false;
        if (!firstInvalid) firstInvalid = comments;
      }

      var privacyOk = validatePrivacy();
      if (!privacyOk) {
        isValid = false;
        if (!firstInvalid) firstInvalid = privacyInput;
      }

      if (!isValid) {
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      // Simulated submission — no backend is wired up.
      form.classList.add('hidden');
      successPanel.classList.remove('hidden');
      successPanel.focus();
      successPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      form.reset();
      volumeWarning.classList.add('hidden');
      updateCommentsCounter();
    });
  });
})();