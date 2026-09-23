# নতুন clean storefront theme ও isolated loading

## লক্ষ্য
বর্তমান **সহজ শপ** অক্ষত রেখে একটি পঞ্চম, সম্পূর্ণ ভিন্ন clean theme যোগ করা হবে। নাম হবে **পরিপাটি (Poripati)**—কমপ্যাক্ট কিন্তু premium commerce layout, যেখানে header, banner, category, product cards, product listing, product detail, checkout, success page এবং footer—সবকিছুর নিজস্ব নকশা থাকবে।

## কী তৈরি হবে
- নতুন theme picker card, আলাদা color palettes এবং নিজের editable content fields।
- স্বতন্ত্র header: slim utility row, centered brand/search composition, icon-based cart এবং পরিষ্কার mobile drawer।
- স্বতন্ত্র home: edge-to-edge image-led banner, horizontal category rail, editorial product grid, focused trust/review/FAQ sections।
- নতুন product card: আলাদা image ratio, price/order placement, offer/free-delivery treatment এবং mobile/desktop grid।
- shop ও category pages: theme-specific title/sort toolbar ও listing layout।
- product detail page: আলাদা gallery, sticky purchase panel, quantity/cart/order controls, details/returns এবং related products।
- checkout ও order-success pages: একই theme language-এ পরিষ্কার form, order summary এবং confirmation state।
- header, mobile menu এবং footer সম্পূর্ণ আলাদা হবে; সহজ শপ বা অন্য theme-এর layout reuse করে শুধু color বদলানো হবে না।

## Load-speed কাঠামো
- প্রতিটি theme-এর visual implementation আলাদা module-এ থাকবে।
- storefront data পাওয়ার পর শুধু active theme module dynamic import হবে; inactive theme-এর header, sections, cards, PDP, checkout বা footer bundle download হবে না।
- shared data, cart, order logic, delivery calculation ও menu model থাকবে lightweight core-এ।
- Google Analytics, Facebook Pixel এবং TikTok Pixel বর্তমান global storefront layer-এই থাকবে—theme bundle-এর মধ্যে যাবে না।
- reseller preview-তেও শুধু নির্বাচিত theme load হবে; preview নিজে থেকে load হবে না।

## নিরাপত্তা ও যাচাই
- আগের Backup & restore কাজ থেকে নতুন backup RPC permission warnings আগে বন্ধ করা হবে, functionality অক্ষত রেখে।
- desktop ও mobile-এ home, shop, category, product, checkout, thanks এবং mobile menu দেখা ও ব্যবহার করে যাচাই হবে।
- network/build output দেখে নিশ্চিত করা হবে active theme ছাড়া অন্য theme chunk request হচ্ছে না।
- tracking initialization ও purchase/view/add-to-cart events global অবস্থায় আছে কিনা যাচাই হবে।

## অপরিবর্তিত থাকবে
- বর্তমান চার theme-এর saved content/palette এবং reseller store data।
- storefront bootstrap-এর এক-call data loading।
- order, payment, delivery, cart ও tracking business logic।
