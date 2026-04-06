# SEO Maintenance Guide - Event Pages

## Overview
This guide explains how to maintain and update the SEO implementation for event pages on flughafen-muenchen.taxi.

## File Structure

### Main Files
1. **`src/lib/eventsData.ts`**
   - Contains all event data including SEO fields
   - Event interface definition
   - 20 complete events with SEO data

2. **`src/app/[locale]/events/[slug]/page.tsx`**
   - Dynamic page component
   - Renders SEO metadata
   - Generates JSON-LD schemas
   - Displays event details and related events

### Support Files
- `src/lib/eventsSeoData.ts` - Reference data file
- `scripts/addSeoToEvents.js` - Helper script (documentation)
- `SEO_OPTIMIZATION_SUMMARY.md` - Full technical documentation

---

## Updating Event SEO Data

### Adding a New Event

To add a new event with complete SEO optimization, follow this template in `eventsData.ts`:

```typescript
{
  id: 'event-slug',
  slug: 'event-slug',
  title: {
    de: 'Event Title German',
    en: 'Event Title English',
  },
  // ... existing event fields ...
  website: 'https://www.example.com',
  category: 'trade' | 'cultural' | 'festival' | 'sports' | 'market',

  // SEO FIELDS (required for proper indexing)
  seoTitle: {
    de: '[Event Name] München 20XX | [Category] | Flughafen Taxi', // 50-60 chars
    en: '[Event Name] Munich 20XX | [Category] | Airport Taxi',     // 50-60 chars
  },
  seoDescription: {
    de: 'Taxi zum [Event]. [Key Info]. Zuverlässig, pünktlich, buchen.',  // 150-160 chars
    en: 'Taxi to [Event]. [Key Info]. Reliable, punctual, book online.',   // 150-160 chars
  },
  seoKeywords: {
    de: ['keyword1', 'keyword2', 'keyword3', 'keyword4', 'keyword5'],      // 5-7 keywords
    en: ['keyword1', 'keyword2', 'keyword3', 'keyword4', 'keyword5'],
  },
  ogImage: '🎪', // Event emoji or image URL
  schema: {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: 'Event Name',
    startDate: '2024-MM-DD',
    endDate: '2024-MM-DD',
    location: {
      '@type': 'Place',
      name: 'Location Name',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Street Address',
        addressLocality: 'Munich',
        postalCode: '80000',
        addressCountry: 'DE',
      },
    },
    image: '🎪',
    description: 'Short description',
    organizer: {
      '@type': 'Organization',
      name: 'flughafen-muenchen.taxi',
      url: 'https://flughafen-muenchen.taxi',
    },
    url: 'https://flughafen-muenchen.taxi/de/events/event-slug',
  },
  relatedEvents: ['slug1', 'slug2', 'slug3'], // 2-3 related event slugs
}
```

### Editing Existing Event SEO

To update SEO data for an existing event:

1. **Open** `src/lib/eventsData.ts`
2. **Find** the event by slug or id
3. **Update** the SEO fields:
   - `seoTitle`: Keep 50-60 characters
   - `seoDescription`: Keep 150-160 characters
   - `seoKeywords`: Ensure relevance
   - `ogImage`: Update if needed
   - `schema`: Update dates/location/organizer as needed
   - `relatedEvents`: Maintain 2-3 related events

### Example: Updating Event Dates in Schema

```typescript
// BEFORE
startDate: '2024-04-08',
endDate: '2024-04-14',

// AFTER (for next year)
startDate: '2025-04-07',
endDate: '2025-04-13',
```

---

## SEO Best Practices

### SEO Title (50-60 characters)
✅ DO:
- Include event name
- Include year if applicable
- Include "München" or "Munich"
- Include "Taxi" or "Transfer"
- Use pipes (|) as separators

❌ DON'T:
- Exceed 60 characters (will be cut off in SERPs)
- Keyword stuff
- Use special characters other than |, (, ), &

### SEO Description (150-160 characters)
✅ DO:
- Start with action verb (Taxi, Transfer)
- Include key event details (dates, category)
- Include CTA (buchen, book, online)
- Be compelling and click-worthy
- Use both German and English accurately

❌ DON'T:
- Exceed 160 characters (will be truncated)
- Duplicate titles
- Make false claims
- Use keyword stuffing

### Keywords (5-7 per language)
✅ DO:
- Include event name
- Include location (München, Munich)
- Include service (Taxi, Transfer)
- Include category keywords
- Use natural language

❌ DON'T:
- Use irrelevant keywords
- Exceed 7 keywords
- Use duplicate keywords
- Use plurals if singular is searched

### Related Events
✅ DO:
- Link to genuinely related events
- Maintain 2-3 relationships per event
- Create a web of semantic connections
- Update when adding new events

❌ DON'T:
- Link to unrelated events
- Create circular relationships only
- Exceed 3 related events

---

## JSON-LD Schema Maintenance

### When to Update Event Schema

1. **Date Changes**
   - Update startDate and endDate in YYYY-MM-DD format

2. **Location Changes**
   - Update location.name
   - Update address.streetAddress
   - Update address.postalCode if applicable

3. **Organizer Changes**
   - Update organizer name if not flughafen-muenchen.taxi
   - Keep URL consistent: https://flughafen-muenchen.taxi

4. **Event Information**
   - Update name to match event.title
   - Update description for clarity

### Schema Validation

To validate JSON-LD schemas, use:
- **Google's Structured Data Testing Tool**: https://search.google.com/test/rich-results
- **Schema.org Validator**: https://schema.org/
- **Rich Results Test**: https://search.google.com/test/rich-results

---

## Testing Changes

### After updating SEO data:

1. **Visual Test**
   - Open the event page in browser
   - Check that title/description appear correctly
   - Verify OG image displays

2. **SEO Validation**
   - Run page through Google's Rich Results Test
   - Check for schema validation errors
   - Verify breadcrumb schema

3. **Link Check**
   - Verify related events links work
   - Check that "More Events" section appears
   - Test navigation between event pages

4. **Bilingual Test**
   - Switch between DE/EN language
   - Verify translations are correct
   - Check that metadata switches properly

---

## Common Issues & Solutions

### Issue: Meta description too long
**Solution**: Remove less important details. Aim for 150-160 characters.

### Issue: Related events not showing
**Solution**: Verify slugs in `relatedEvents` array match actual event slugs in the data.

### Issue: SEO title not appearing
**Solution**: Check for special characters. Only |, (, ), & are safe. Avoid emoji in titles.

### Issue: Schema validation errors
**Solution**:
- Verify all dates are in YYYY-MM-DD format
- Ensure all required fields are present
- Check for proper JSON syntax

### Issue: OG image not displaying on social
**Solution**:
- If using emoji: Some social platforms may not render emojis
- Use full image URL instead: `ogImage: 'https://example.com/image.jpg'`
- Ensure image is 1200x630px or larger for best results

---

## Analytics & Monitoring

### What to Monitor

1. **Search Console**
   - Click-through rate for event pages
   - Search impressions
   - Keyword rankings
   - Indexation status

2. **Google Analytics**
   - Organic traffic to event pages
   - Bounce rate
   - Pages per session
   - Time on page

3. **Social Media**
   - Shares using OG cards
   - Click-through from shared links
   - Engagement metrics

### Monthly Review Checklist

- [ ] Check Search Console for errors
- [ ] Review top-performing keywords
- [ ] Monitor organic traffic trends
- [ ] Check for ranking improvements
- [ ] Verify schema validation
- [ ] Update dates for upcoming events
- [ ] Add new events if necessary
- [ ] Review related events relationships

---

## TypeScript Types Reference

### Event Interface
```typescript
interface Event {
  id: string;
  slug: string;
  title: { de: string; en: string };
  description: { de: string; en: string };
  shortDescription: { de: string; en: string };
  dateRange: { start: string; end: string; month: string };
  location: { de: string; en: string; address: string };
  stats: EventStats;
  tips: EventTip[];
  highlights: { de: string[]; en: string[] };
  highlights_description: { de: string; en: string };
  website?: string;
  category: 'trade' | 'cultural' | 'festival' | 'sports' | 'market';

  // SEO Fields
  seoTitle: { de: string; en: string };
  seoDescription: { de: string; en: string };
  seoKeywords: { de: string[]; en: string[] };
  ogImage: string;
  schema: EventSchema;
  relatedEvents: string[];
}
```

### EventSchema Interface
```typescript
interface EventSchema {
  '@context': string;
  '@type': string;
  name: string;
  startDate: string;
  endDate: string;
  location: {
    '@type': string;
    name: string;
    address: {
      '@type': string;
      streetAddress: string;
      addressLocality: string;
      postalCode: string;
      addressCountry: string;
    };
  };
  image: string;
  description: string;
  organizer: {
    '@type': string;
    name: string;
    url: string;
  };
  url: string;
}
```

---

## Deployment Checklist

Before deploying SEO changes:

- [ ] All events have complete SEO fields
- [ ] No character count violations (title 50-60, desc 150-160)
- [ ] Schema validation passes
- [ ] Related events are valid slugs
- [ ] No broken links
- [ ] Bilingual content is correct
- [ ] TypeScript compilation succeeds
- [ ] Page renders without errors
- [ ] OG images display correctly

---

## Performance Optimization

The SEO implementation is optimized for:
- **Page Load**: Minimal impact (schemas in Head only)
- **Build Size**: ~600 lines of data + ~150 lines of component code
- **Runtime Performance**: No additional API calls, all data server-side
- **Accessibility**: Proper heading hierarchy, semantic HTML

---

## Future Enhancements

Consider adding:
1. **FAQ Schema** - For common questions about events
2. **Review/Rating Schema** - If you collect event reviews
3. **Video Schema** - If promotional videos are added
4. **Image Schema** - For better image search optimization
5. **Event Ticket Schema** - If ticketing information is available
6. **Aggregate Rating Schema** - For event popularity
7. **Dynamic Structured Data** - Generated based on user behavior

---

## Support & Resources

- **Google Search Central**: https://developers.google.com/search
- **Schema.org Documentation**: https://schema.org/Event
- **JSON-LD Reference**: https://json-ld.org/
- **Next.js Head Component**: https://nextjs.org/docs/api-reference/next/head

---

**Last Updated**: April 6, 2026
**SEO Version**: 1.0
**Status**: Production Ready
