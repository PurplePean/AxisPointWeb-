/**
 * Locale sets, the one fallback rule, and the templates port.
 *
 * Every renderer in this folder is reached through `realTemplates()`. Nothing in production
 * calls a render function directly, so this file is where a locale is resolved and where a
 * missing renderer turns into an honest permanent failure rather than a blank email.
 */

/**
 * The English visitor-facing template set.
 *
 * ENGLISH IS THE ONLY REAL SET, and that is the honest state: no professional translation
 * pass has happened. What changed is that selection is a lookup rather than a hardcoded
 * call, so adding a reviewed locale later means adding approved content instead of
 * rewriting dispatch.
 *
 * INTERNAL MAIL IS DELIBERATELY ABSENT. Partner notifications and the QR digest stay English
 * regardless of what the visitor asked for: they are read by the two partners, not by the
 * visitor, and they already display the visitor's preferred language as a field.
 */
function englishVisitorTemplates() {
  return {
    renderAcknowledgement: renderWebsiteAcknowledgement,
    renderQrAcknowledgement: renderQrAcknowledgement,
    renderBookingConfirmation: renderBookingConfirmation
  };
}

/**
 * THE ONE FALLBACK RULE: a renderer comes from the requested locale's set when that set
 * exists AND defines it; otherwise English.
 *
 * That covers both failure shapes with one rule. An unknown locale has no set, so English.
 * A supplied but incomplete set is missing this renderer, so English for this message while
 * its other messages still come from its own set. Falling back per renderer rather than per
 * locale is safe because each is a separate, self-contained email: an English booking
 * confirmation beside a translated acknowledgement is two correct messages, not one
 * half-translated one.
 */
function pickTemplate(sets, locale, name) {
  var wanted = sets[locale];
  if (wanted && typeof wanted[name] === 'function') return wanted[name];
  var english = sets.en;
  if (english && typeof english[name] === 'function') return english[name];
  return null;
}

/**
 * Builds the templates port.
 *
 * `extraLocaleSets` is the seam an approved translation plugs into, and it has no production
 * caller today. It replaced `registerVisitorTemplateSet` and `clearVisitorTemplateSet`,
 * which mutated module state that lives for the whole Apps Script execution. Shipping
 * test-only mutation into deployable source means production carries functions whose only
 * purpose is to let a test change global behaviour, and one stray call would swap a
 * visitor-facing template at runtime. Injection gives the same extension seam with nothing
 * mutable to reach: the sets are built per call and never written to again.
 */
function realTemplates(extraLocaleSets) {
  var sets = { en: englishVisitorTemplates() };
  if (extraLocaleSets) {
    Object.keys(extraLocaleSets).forEach(function (code) {
      sets[code] = extraLocaleSets[code];
    });
  }

  function visitor(name, locale) {
    return pickTemplate(sets, locale || 'en', name);
  }

  return {
    /*
     * Each visitor-facing renderer takes an OPTIONAL trailing locale. Optional on purpose:
     * every existing caller and test fake that passes nothing still gets English, so this
     * added a capability without breaking a contract.
     */
    renderAcknowledgement: function (lead, config, locale) {
      var fn = visitor('renderAcknowledgement', locale);
      if (!fn) return { ok: false, permanent: true, reason: 'template_missing' };
      return fn(lead, config);
    },
    renderQrAcknowledgement: function (contact, config, locale) {
      var fn = visitor('renderQrAcknowledgement', locale);
      if (!fn) return { ok: false, permanent: true, reason: 'template_missing' };
      return fn(contact, config);
    },
    renderBookingConfirmation: function (lead, booking, config, locale) {
      var fn = visitor('renderBookingConfirmation', locale);
      if (!fn) return { ok: false, permanent: true, reason: 'template_missing' };
      return fn(lead, booking, config);
    },

    // Internal, always English. No locale parameter, so no caller can ask for one.
    renderPartnerNotification: renderInternalNotification,
    renderQrDigest: renderQrDigest
  };
}
