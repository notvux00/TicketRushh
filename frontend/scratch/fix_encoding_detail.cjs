const fs = require('fs');
const filePath = 'd:/Github/TicketRush/frontend/src/pages/EventDetail.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const mapping = {
    'Sá»± kiá»‡n': 'Sự kiện',
    'Thanh ToÃ¡n': 'Thanh Toán',
    'Ä‘': 'đ',
    'VNÄ ': 'VNĐ',
    'Báº£ng GiÃ¡': 'Bảng Giá',
    'MÃ‚M': 'MÂM',
    'Gháº¾': 'GHẾ',
    'Chá» n': 'Chọn',
    'KhÃ´ng': 'Không'
};

for (const [key, value] of Object.entries(mapping)) {
    content = content.split(key).join(value);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed encoding for EventDetail.jsx');
