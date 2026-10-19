const fs = require('fs');
const path = require('path');

const filePath = 'd:/Github/TicketRush/frontend/src/pages/BookingPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const mapping = {
    'Háº±ng sá»‘': 'Hằng số',
    'Láº¥y giá»  hÃ ng tá»«': 'Lấy giỏ hàng từ',
    'báº£o vá»‡ ngÆ°á» i mua': 'bảo vệ người mua',
    'LÆ°u giá»  hÃ ng vÃ o': 'Lưu giỏ hàng vào',
    'thay Ä‘á»•i': 'thay đổi',
    'Cáº­p nháº­t tráº¡ng thÃ¡i gháº¿': 'Cập nhật trạng thái ghế',
    'ngÆ°á» i dÃ¹ng': 'người dùng',
    'tháº±ng khÃ¡c': 'người khác',
    'khÃ³a máº¥t': 'khóa mất',
    'xÃ³a khá» i giá» ': 'xóa khỏi giỏ',
    'KhÃ´ng thá»ƒ láº¥y dá»¯ liá»‡u gháº¿ ngá»“i!': 'Không thể lấy dữ liệu ghế ngồi!',
    'gháº¿': 'ghế',
    'khÃ³a bá»Ÿi': 'khóa bởi',
    'Ä‘Ã£ bÃ¡n': 'đã bán',
    'giáº£i phÃ³ng': 'giải phóng',
    'Báº¡n chá»‰ Ä‘Æ°á»£c chá» n tá»‘i Ä‘a': 'Bạn chỉ được chọn tối đa',
    'vÃ©!': 'vé!',
    'Lá»—i': 'Lỗi',
    'Ä‘Äƒng nháº­p': 'đăng nhập',
    'giá»¯': 'giữ',
    'CÃ’N TRá» NG': 'CÒN TRỐNG',
    'Ä ANG CHá»ŒN': 'ĐANG CHỌN',
    'Ä ANG GIá»®': 'ĐANG GIỮ',
    'Háº¾T CHá»–': 'HẾT CHỖ',
    'Quay láº¡i sÆ¡ Ä‘á»“': 'Quay lại sơ đồ',
    'Khu vá»±c:': 'Khu vực:',
    'Khu vá»±c': 'Khu vực',
    'VNÄ ': 'VNĐ',
    'SÃ¢n Kháº¥u': 'Sân Khấu',
    'KhÃ´ng kháº£ dá»¥ng': 'Không khả dụng',
    'TRá» NG': 'TRỐNG',
    'Ä Ãƒ BÃ N': 'ĐÃ BÁN',
    'Sá»± Kiá»‡n': 'Sự Kiện',
    'Báº£ng GiÃ¡': 'Bảng Giá',
    'Gháº¾ Ä Ã£ Chá» n': 'GHẾ ĐÃ CHỌN',
    'ChÆ°a cÃ³': 'Chưa có',
    'Tá»•ng cá»™ng': 'Tổng cộng',
    'Ä‘': 'đ',
    'Thanh ToÃ¡n': 'Thanh Toán',
    'CÃ’N Láº I': 'CÒN LẠI',
    'ðŸ“ ': '📍',
    'ðŸ—“ï¸ ': '📅'
};

for (const [key, value] of Object.entries(mapping)) {
    content = content.split(key).join(value);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed encoding for BookingPage.jsx');
