import express from 'express';
import { supabase } from '../lib/supabase';

const router = express.Router();

router.get('/', async (req, res) => {
    const status = {
        server: 'ok',
        timestamp: new Date().toISOString(),
        env: {
            NODE_ENV: process.env.NODE_ENV,
        },
        services: {
            supabase: { status: 'unknown', message: '' }
        }
    };

    // Check Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        status.services.supabase = { 
            status: 'disconnected', 
            message: 'Missing credentials (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set)' 
        };
    } else if (!supabase) {
        status.services.supabase = { 
            status: 'disconnected', 
            message: 'Client not initialized' 
        };
    } else {
        try {
            // Simple query to check connection with timeout
            const queryPromise = supabase.from('emails').select('id').limit(1);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Connection timeout')), 5000)
            );
            
            const { error } = await Promise.race([queryPromise, timeoutPromise]) as any;
            
            if (error) {
                status.services.supabase = { 
                    status: 'error', 
                    message: `Database error: ${error.message}` 
                };
            } else {
                status.services.supabase = { 
                    status: 'connected', 
                    message: 'Operational' 
                };
            }
        } catch (err: any) {
            // Handle network errors, timeouts, etc.
            const errorMessage = err.message || 'Unknown error';
            if (errorMessage.includes('fetch failed') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
                status.services.supabase = { 
                    status: 'error', 
                    message: `Cannot reach Supabase (check URL: ${supabaseUrl ? 'configured' : 'missing'})` 
                };
            } else if (errorMessage.includes('timeout')) {
                status.services.supabase = { 
                    status: 'error', 
                    message: 'Connection timeout - Supabase may be unreachable' 
                };
            } else {
                status.services.supabase = { 
                    status: 'error', 
                    message: errorMessage 
                };
            }
        }
    }

    res.json(status);
});

export default router;
