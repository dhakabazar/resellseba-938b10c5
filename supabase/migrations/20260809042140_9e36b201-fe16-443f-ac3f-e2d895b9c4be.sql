DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name IN (
            SELECT table_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND column_name = 'reseller_id'
        )
        AND table_name != 'resellers'
    LOOP
        EXECUTE format('
            DO $inner$
            DECLARE
                const_name text;
            BEGIN
                SELECT tc.constraint_name INTO const_name
                FROM information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu 
                  ON tc.constraint_name = kcu.constraint_name 
                  AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = ''FOREIGN KEY'' 
                  AND tc.table_name = %L 
                  AND kcu.column_name = ''reseller_id'';
                
                IF const_name IS NOT NULL THEN
                    EXECUTE format(''ALTER TABLE public.%%I DROP CONSTRAINT %%I'', %L, const_name);
                END IF;
                
                EXECUTE format(''ALTER TABLE public.%%I ADD CONSTRAINT %%I_reseller_id_fkey FOREIGN KEY (reseller_id) REFERENCES public.resellers(id) ON DELETE CASCADE'', %L, %L);
            END $inner$;
        ', r.table_name, r.table_name, r.table_name, r.table_name);
    END LOOP;
END $$;