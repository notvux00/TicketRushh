# Nguồn ảnh demo

Ảnh sự kiện demo được đóng gói cùng frontend trong `frontend/public/images/events/`.
Tất cả đều là ảnh **CC0** (không bắt buộc ghi công) lấy từ Wikimedia Commons; ảnh
đã được crop 16:9 và nén JPEG để nhẹ hơn.

| File | Ảnh gốc | Giấy phép |
| --- | --- | --- |
| `concert.jpg` | [Rock concert in intense light (Unsplash)](https://commons.wikimedia.org/wiki/File:Rock_concert_in_intense_light_(Unsplash).jpg) | CC0 |
| `movie.jpg` | [HK AirSide MCL Cinemas room interior row seats](https://commons.wikimedia.org/wiki/File:HK_%E5%95%9F%E5%BE%B7%E5%95%86%E5%A0%B4_AirSide_Kai_Tak_Mall_%E9%9B%BB%E5%BD%B1%E9%99%A2_MCL_Cinemas_room_interior_row_seats_January_2024_R12S_01.jpg) | CC0 |
| `sports.jpg` | [Incheon Soccer Stadium 4](https://commons.wikimedia.org/wiki/File:Incheon_Soccer_Stadium_4.JPG) | CC0 |
| `comedy.jpg` | [Jeff Duran performing at the Comedy Store](https://commons.wikimedia.org/wiki/File:Jeff_Duran_Performing_At_The_World_Famous_Comedy_Store.png) | CC0 |
| `../fallback-event.svg` | Tự thiết kế cho TicketRush | Nội bộ |

Migration `V10__demo_event_covers.sql` trỏ 4 sự kiện seed về các file này để demo
không phụ thuộc host ảnh bên ngoài.
