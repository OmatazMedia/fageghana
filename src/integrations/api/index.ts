/**
 * FAGE API — Main Export
 * 
 * Drop-in replacement for the Supabase client.
 * Import domain-specific modules for type-safe API calls:
 * 
 *   import { auth, content, member, admin } from "@/integrations/api";
 * 
 *   // Auth
 *   const { user } = await auth.signIn({ email, password });
 *   
 *   // Public content
 *   const news = await content.news.list();
 *   const stats = await content.stats();
 *   
 *   // Member dashboard
 *   const profile = await member.profile.get();
 *   const tickets = await member.tickets.list();
 *   
 *   // Admin management
 *   const users = await admin.users.list();
 *   const reports = await admin.reports.payments();
 */

export { auth } from './modules/auth';
export { content } from './modules/content';
export { member } from './modules/member';
export { admin } from './modules/admin';

// Re-export the generic client for backward compatibility
export { api, supabase } from './client';
