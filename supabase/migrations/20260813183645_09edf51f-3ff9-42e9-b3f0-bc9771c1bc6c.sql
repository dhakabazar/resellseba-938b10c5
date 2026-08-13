-- Seed FAQ section into landing page content if not already present
UPDATE public.global_settings
SET landing_content = jsonb_set(
  COALESCE(landing_content, '{}'::jsonb),
  '{faq}',
  jsonb_build_object(
    'title', 'সাধারণ প্রশ্ন',
    'subtitle', 'রিসেলারদের মনে আসা কিছু প্রশ্ন ও উত্তর',
    'items', jsonb_build_array(
      jsonb_build_object('q', 'কীভাবে রিসেলার হতে পারব?', 'a', 'সাইনআপ করে স্টোর সেটআপ করুন, প্রোডাক্ট লিস্ট করুন, আর কাস্টমারের অর্ডার প্যানেলে নিন। অ্যাডমিন অ্যাপ্রুভের পর সম্পূর্ণ অ্যাক্সেস পাবেন।'),
      jsonb_build_object('q', 'কত টাকা দিয়ে শুরু করতে হয়?', 'a', 'কোনো সেটআপ ফি বা মাসিক ফি নেই। প্রোডাক্ট কিনে স্টক রাখতে হয় না — অর্ডার পেলে অ্যাডমিন প্যাকিং ও ডেলিভারি করে।'),
      jsonb_build_object('q', 'প্রোডাক্টের দাম কে ঠিক করে?', 'a', 'অ্যাডমিন বেস কস্ট ও ডেলিভারি চার্জ দিয়ে দেয়। রিসেলার সেই কস্টের উপর নিজের মার্জিন/প্রফিট বসিয়ে বিক্রয় মূল্য ঠিক করেন।'),
      jsonb_build_object('q', 'ডেলিভারি ও কুরিয়ার কে করবে?', 'a', 'Steadfast, Pathao, CarryBee — যেকোনো সক্রিয় কুরিয়ারে অ্যাডমিন বুকিং করে। আপনাকে শুধু ট্র্যাকিং আইডি কাস্টমারকে শেয়ার করতে হবে।'),
      jsonb_build_object('q', 'প্রফিট কীভাবে পাব?', 'a', 'প্রতিটি ডেলিভারি সম্পন্ন অর্ডার থেকে আপনার প্যানেলে প্রফিট জমা হবে। উইথড্র রিকোয়েস্ট দিলে bKash/Nagad/ব্যাংকে পেমেন্ট করা হয়।'),
      jsonb_build_object('q', 'কাস্টমার কি আমার স্টোরের বাইরে কিছু দেখতে পাবে?', 'a', 'না। কাস্টমার শুধু আপনার ব্র্যান্ডেড স্টোর, আপনার লিস্টিং ও আপনার দেওয়া তথ্যই দেখবে। অ্যাডমিন বা প্ল্যাটফর্মের কোনো তথ্য লিক হয় না।')
    )
  ),
  true
)
WHERE id = 1 AND (landing_content->'faq') IS NULL;

-- Ensure nav has FAQ label
UPDATE public.global_settings
SET landing_content = jsonb_set(
  COALESCE(landing_content, '{}'::jsonb),
  '{nav,faq}',
  '"FAQ"',
  true
)
WHERE id = 1;