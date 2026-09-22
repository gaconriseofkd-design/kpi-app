-- ==============================================================================
-- TẠO BUCKET LƯU TRỮ HÌNH ẢNH MQAA (mqaa-images) VÀ THIẾT LẬP QUYỀN TRUY CẬP
-- Chạy đoạn SQL này trong mục SQL Editor trên Supabase Dashboard
-- ==============================================================================

-- 1. Tạo bucket 'mqaa-images' và bật chế độ Public
INSERT INTO storage.buckets (id, name, public)
VALUES ('mqaa-images', 'mqaa-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Cho phép xem ảnh công khai không cần đăng nhập (Public Read)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public Access mqaa-images'
    ) THEN
        CREATE POLICY "Public Access mqaa-images"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'mqaa-images');
    END IF;
END $$;

-- 3. Cho phép tải ảnh lên kho (Public Insert / Upload)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public Upload mqaa-images'
    ) THEN
        CREATE POLICY "Public Upload mqaa-images"
        ON storage.objects FOR INSERT
        WITH CHECK (bucket_id = 'mqaa-images');
    END IF;
END $$;

-- 4. Cho phép cập nhật ảnh (Public Update)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public Update mqaa-images'
    ) THEN
        CREATE POLICY "Public Update mqaa-images"
        ON storage.objects FOR UPDATE
        USING (bucket_id = 'mqaa-images');
    END IF;
END $$;
