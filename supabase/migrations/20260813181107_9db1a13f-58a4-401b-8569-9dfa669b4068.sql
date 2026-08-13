update public.global_settings
set landing_content = jsonb_set(
  coalesce(landing_content, '{}'::jsonb),
  '{features,items}',
  (
    select jsonb_agg(jsonb_build_object('icon', icon, 'title', title, 'desc', "desc"))
    from (values
      ('Boxes', 'হাজারো প্রোডাক্ট, এক ক্লিকে লিস্ট', 'ভেরিফাইড ক্যাটালগ, HD ছবি, SEO কন্টেন্ট — স্টক কিনতে হবে না।'),
      ('Wallet', 'নিজের প্রফিট নিজে ঠিক করুন', 'কস্ট দেখেই মার্জিন বসান, পুরো প্রফিট আপনার।'),
      ('Truck', 'কুরিয়ার বুকিং আমরা করি', 'Steadfast, Pathao, CarryBee — প্যাকেজিং থেকে ট্র্যাকিং পর্যন্ত।'),
      ('Globe', 'নিজের ব্র্যান্ডেড স্টোর', 'কাস্টম ডোমেইন, লোগো, কালার, থিম — কাস্টমার শুধু আপনাকে দেখবে।'),
      ('Wallet', 'পেমেন্ট সবচেয়ে সহজ', 'bKash, Nagad, Rocket, SSLCommerz, EPS — COD + অনলাইন।'),
      ('Megaphone', 'Ads ট্র্যাকিং অটো', 'Facebook Pixel/CAPI + TikTok Events API — কোন অ্যাডে কত সেল।'),
      ('BarChart3', 'লাইভ প্রফিট রিপোর্ট', 'সেল, রেভিনিউ, ডিউ, রিটার্ন — সব রিয়েল-টাইমে।'),
      ('ShieldCheck', 'ডেটা সম্পূর্ণ প্রাইভেট', 'প্রতিটি রিসেলারের অর্ডার ও কাস্টমার ডেটা আলাদা।'),
      ('Sparkles', 'টিম ও কমিশন সিস্টেম', 'স্টাফ পারমিশন, লিডার রিসেলার — ইনকাম বাড়ান।')
    ) as t(icon, title, "desc")
  )
)
where id = 1;