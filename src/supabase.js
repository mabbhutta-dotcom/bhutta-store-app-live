import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dxjtmciaaiwlvdhxyvqm.supabase.co';
const supabaseKey = 'sb_publishable_GOCw5npONF6yFpVNrfX-tw_aCIv79sS';

export const supabase = createClient(supabaseUrl, supabaseKey);