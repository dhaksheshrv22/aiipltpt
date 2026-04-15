ALTER TABLE public.active_vehicles
ADD COLUMN is_temporarily_out boolean NOT NULL DEFAULT false,
ADD COLUMN temp_exit_time timestamp with time zone,
ADD COLUMN return_time timestamp with time zone;