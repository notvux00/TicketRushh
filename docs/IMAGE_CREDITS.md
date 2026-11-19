# Nguồn ảnh demo

Ảnh sự kiện demo được đóng gói cùng frontend trong `frontend/public/images/events/`.
Ảnh lấy từ Wikimedia Commons, thuộc **CC0** hoặc **CC BY-SA**; ảnh CC BY-SA giữ
ghi công tác giả trong bảng dưới. Tất cả đã được crop 16:9 và nén JPEG.

| File | Ảnh gốc | Giấy phép / tác giả |
| --- | --- | --- |
| `concert.jpg` | [Rock concert in intense light (Unsplash)](https://commons.wikimedia.org/wiki/File:Rock_concert_in_intense_light_(Unsplash).jpg) | CC0 |
| `movie.jpg` | [HK AirSide MCL Cinemas room interior row seats](https://commons.wikimedia.org/wiki/File:HK_%E5%95%9F%E5%BE%B7%E5%95%86%E5%A0%B4_AirSide_Kai_Tak_Mall_%E9%9B%BB%E5%BD%B1%E9%99%A2_MCL_Cinemas_room_interior_row_seats_January_2024_R12S_01.jpg) | CC0 |
| `sports.jpg` | [Incheon Soccer Stadium 4](https://commons.wikimedia.org/wiki/File:Incheon_Soccer_Stadium_4.JPG) | CC0 |
| `comedy.jpg` | [Jeff Duran performing at the Comedy Store](https://commons.wikimedia.org/wiki/File:Jeff_Duran_Performing_At_The_World_Famous_Comedy_Store.png) | CC0 |
| `festival.jpg` | [Main stage of Sasquatch! Music Festival in May 2015](https://commons.wikimedia.org/wiki/File:Main_stage_of_Sasquatch!_Music_Festival_in_May_2015.jpg) | CC0 — PinchyCC |
| `orchestra.jpg` | [Great Amber Concert Hall, Liepāja Symphony Orchestra](https://commons.wikimedia.org/wiki/File:Great_Amber_Concert_Hall,_Liep%C4%81ja_Symphony_Orchestra,_Duo_Amal,_Matthias_Manasi.jpg) | CC0 — SintaBerzins |
| `cinema.jpg` | [Kino Balt Suteren Interier Kinosal A](https://commons.wikimedia.org/wiki/File:Kino_Balt_Suteren_Interier_Kinosal_A.jpg) | CC0 — Mojmir Churavy |
| `basketball.jpg` | [Wisconsin vs. Marquette men's basketball 2024, in-game action](https://commons.wikimedia.org/wiki/File:Wisconsin_vs._Marquette_men%27s_basketball_2024_23_(in-game_action).jpg) | CC BY-SA 4.0 — Michael Barera |
| `workshop.jpg` | [2014 Landscape Photography Workshop, Northumberland](https://commons.wikimedia.org/wiki/File:2014_Landscape_Photography_Workshop,_Northumberland_(12039541545).jpg) | CC BY-SA 2.0 — marsupium photography |
| `theater.jpg` | [The Konkani tiatr stage, Prince Jacob's troupe](https://commons.wikimedia.org/wiki/File:The_Konkani_tiatr_(traditional_theatre)_stage._Prince_Jacob%27s_troupe._May_2023._01.jpg) | CC BY-SA 4.0 — Fredericknoronha |
| `../fallback-event.svg` | Tự thiết kế cho TicketRush | Nội bộ |

Migration `V10__demo_event_covers.sql` trỏ 4 sự kiện seed cũ về ảnh local.
Migration `V11__demo_catalog_expansion.sql` thêm 6 sự kiện mới và dùng các ảnh
`festival`, `orchestra`, `cinema`, `basketball`, `workshop`, `theater` để demo
không phụ thuộc host ảnh bên ngoài.
