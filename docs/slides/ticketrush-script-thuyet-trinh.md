# Kịch bản thuyết trình TicketRush

Kịch bản đi theo [bộ 25 slide bảo vệ](ticketrush-bao-ve-aws.html). Thời lượng tập thử là **14 phút**. Slide 25 dùng khi hội đồng hỏi về đề cương hoặc cần xem minh chứng.

| Người trình bày | Slide | Thời lượng | Phần phụ trách |
| --- | --- | ---: | --- |
| **Nguyễn Anh Tuấn** | 1–11 | 4 phút 45 giây | Giới thiệu, bài toán, kiến trúc tổng thể, mạng và đường truy cập |
| **Nguyễn Xuân Thành** | 12–16 | 3 phút 45 giây | Hạ tầng backend, Terraform, IAM, quy trình phát hành và Auto Scaling |
| **Lê Duy Vũ** | 17–24 | 5 phút 30 giây | Dữ liệu đặt vé, bảo trì, giám sát, kiểm thử API, chi phí và kết luận |

## Nguyễn Anh Tuấn · Slide 1–11

### Slide 01 — TicketRush

*15 giây.*

> Em chào thầy cô. Nhóm em xin trình bày TicketRush, hệ thống đặt vé sự kiện triển khai trên AWS. Nhóm chọn tình huống mở bán vé để giải thích cách hạ tầng đám mây xử lý tải tăng và bảo vệ dữ liệu đặt chỗ.

### Slide 02 — Thành viên nhóm

*15 giây.*

> Nhóm em có ba thành viên là Nguyễn Anh Tuấn, Nguyễn Xuân Thành và Lê Duy Vũ. Em là Tuấn và sẽ trình bày phần mạng, Thành trình bày triển khai backend, còn Vũ trình bày dữ liệu, vận hành và kết quả.

### Slide 03 — Mục lục

*15 giây.*

> Nhóm em bắt đầu từ bài toán và kiến trúc tổng thể. Sau đó, tụi em sẽ đi theo đường của một yêu cầu đặt vé, từ lúc khách mở trang web, qua backend, tới lúc ghi dữ liệu. Cuối cùng là kết quả kiểm thử và chi phí.

### Slide 04 — Bài toán và yêu cầu

*30 giây.*

> Khi một sự kiện vừa mở bán, nhiều người có thể vào cùng lúc và chọn đúng một ghế. Backend cần mở rộng để nhận thêm yêu cầu, đồng thời hệ thống cần giữ ghế cho một khách trong lúc thanh toán. Nếu khách bỏ dở đơn, ghế phải được giải phóng để người khác có thể mua. Đây là ba tình huống nhóm dùng để thiết kế hạ tầng.

### Slide 05 — Phạm vi chức năng và yêu cầu

*30 giây.*

> Khách có thể xem sự kiện, vào hàng đợi khi đông người, chọn ghế theo thời gian thực, áp voucher và nhận vé QR sau bước thanh toán mô phỏng. Ban tổ chức có thể tạo sự kiện, dựng sơ đồ ghế và soát vé. Về cloud, nhóm đặt yêu cầu triển khai qua hai vùng sẵn sàng, tách backend và dữ liệu vào mạng riêng, rồi cấp quyền bằng IAM role.

### Slide 06 — Kiến trúc AWS tổng thể

*35 giây. Chỉ lần lượt vào nhánh giao diện và nhánh API.*

> Cả giao diện và API dùng chung một tên miền. Trình duyệt đến CloudFront trước. Với giao diện, CloudFront đọc tệp từ S3. Với yêu cầu API, CloudFront chuyển tiếp sang bộ cân bằng tải ALB, rồi ALB đưa yêu cầu xuống EC2 trong subnet ứng dụng. Backend truy cập PostgreSQL và Redis qua đường nội bộ khi cần kiểm tra ghế, giữ chỗ hoặc lưu đơn.

### Slide 07 — Sơ đồ kiến trúc đầy đủ

*20 giây. Nếu cần đọc chi tiết, bấm vào ảnh để mở tab lớn.*

> Sơ đồ đầy đủ cho thấy các thành phần vừa nói được bố trí thế nào trên AWS. Hai điểm chính là ALB ở tầng public và backend cùng dữ liệu nằm trong các subnet riêng. Em sẽ đi từ ngoài vào trong ở các slide tiếp theo.

### Slide 08 — Route 53 và AWS Certificate Manager

*25 giây.*

> Khi khách mở tên miền TicketRush, Route 53 đưa trình duyệt đến CloudFront. ACM quản lý chứng chỉ cho hai kết nối HTTPS. Chứng chỉ phía trình duyệt được cấp ở us-east-1 theo yêu cầu của CloudFront. Chứng chỉ cho kết nối từ CloudFront tới ALB nằm ở vùng triển khai ALB.

### Slide 09 — CloudFront và Amazon S3

*30 giây.*

> Nhóm dùng hai bucket S3 riêng cho bản build giao diện và ảnh sự kiện. Hai bucket chặn truy cập công khai. CloudFront ký yêu cầu đọc tệp qua OAC, rồi có thể cache nội dung tĩnh để giảm lượt truy cập về origin. Riêng đường dẫn API và WebSocket được chuyển về ALB với cache tắt, vì chúng phục vụ dữ liệu động.

### Slide 10 — VPC và NAT Gateway

*35 giây.*

> Trong VPC, nhóm bố trí sáu subnet trên hai AZ. Mỗi AZ có một subnet public, một subnet ứng dụng và một subnet dữ liệu. ALB nhận yêu cầu ở tầng public, EC2 chạy ở tầng ứng dụng, còn RDS và Redis nằm ở tầng dữ liệu. Khi EC2 cần kết nối ra ngoài để khởi động hoặc lấy cấu hình, lưu lượng đi qua NAT Gateway. Demo dùng chung một NAT để giảm chi phí, nên đường ra qua NAT phụ thuộc vào AZ chứa nó.

### Slide 11 — Application Load Balancer

*35 giây. Chỉ vào ảnh Target Group khi nói kết quả 2/2.*

> ALB nhận HTTPS trên cổng 443 từ CloudFront. Nó kiểm tra mã xác minh CloudFront gửi kèm, sau đó mới chuyển yêu cầu đến backend trên cổng 8080. ALB gọi endpoint readiness để biết máy nào sẵn sàng nhận yêu cầu. Ảnh trên slide ghi nhận hai target đều healthy sau triển khai ban đầu.

**Chuyển sang Thành**

> Như vậy, yêu cầu đã đi từ trình duyệt tới EC2. Tiếp theo, em mời Thành trình bày cách nhóm dựng các máy backend, đưa bản mới lên và mở rộng khi tải tăng.

## Nguyễn Xuân Thành · Slide 12–16

### Slide 12 — Amazon EC2 và EBS

*35 giây.*

> Em là Thành. Backend Spring Boot chạy trong container Docker trên EC2 ở private app subnet. Khi nhóm cần thay hay thêm máy, Launch Template cung cấp cùng cấu hình, gồm hệ điều hành, ổ đĩa và script khởi động. Ổ EBS gp3 chứa hệ điều hành và các tệp cục bộ của từng máy. Dữ liệu đơn được lưu ở RDS và ảnh sự kiện ở S3, nên vòng đời của EC2 độc lập với các dữ liệu này.

### Slide 13 — Terraform cho môi trường demo

*45 giây. Chọn hai hàng trong bảng để chỉ.*

> Nhóm dùng Terraform để khai báo hạ tầng một cách nhất quán. Các module trao đổi đầu ra để ghép thành môi trường demo. Ví dụ, module mạng cung cấp ID của private app subnet cho module compute đặt EC2. Module edge cung cấp ARN của Target Group để Auto Scaling Group đăng ký máy với ALB. Module dữ liệu cung cấp endpoint RDS và ARN của secret cho Lambda bảo trì. Terraform lưu state trên S3 và dùng DynamoDB để điều phối khóa khi cập nhật state.

### Slide 14 — AWS IAM

*35 giây.*

> Nhóm tách quyền theo thành phần. EC2 dùng instance profile để kéo image, đọc cấu hình và ghi log theo policy. Lambda có role riêng để đọc secret PostgreSQL và ghi log bảo trì. Khi GitHub Actions triển khai, workflow dùng OIDC để nhận quyền tạm thời từ IAM role. Nhờ đó, quyền triển khai gắn với phiên chạy của workflow và quyền của backend gắn với máy EC2.

### Slide 15 — Phát hành backend qua ECR và SSM

*55 giây. Chỉ lần lượt các bước từ trái sang phải.*

> Khi phát hành, GitHub Actions build Docker image và đẩy lên ECR với một tag. ECR giữ image, còn SSM Parameter Store giữ tag mà môi trường cần chạy. Sau khi cập nhật tag, workflow yêu cầu Auto Scaling Group thực hiện Instance Refresh. Các EC2 mới khởi động theo Launch Template, đọc tag từ SSM rồi kéo đúng image từ ECR. Target Group kiểm tra readiness trước khi đưa máy mới vào luồng nhận yêu cầu. Mục đích của lượt refresh này là thay máy theo đợt để đưa bản phát hành mới vào cụm.

### Slide 16 — Amazon EC2 Auto Scaling

*55 giây. Chỉ ba số liệu trên slide rồi đến lịch sử ASG Activity.*

> Khi lượng yêu cầu tăng, Auto Scaling Group có thể thêm máy để chia tải. Demo chạy trong giới hạn từ hai đến bốn EC2, với Target Tracking dùng CPU mục tiêu 70 phần trăm. Để kiểm thử hạ tầng, nhóm chạy hai tiến trình tạo tải CPU trên mỗi EC2 trong 18 phút. Lịch sử ASG ghi nhận số máy đi từ hai lên ba rồi bốn, đạt mức tối đa sau khoảng sáu phút. Khi đó cả bốn target đều healthy. Sau khi dừng tải, nhóm quan sát số máy giảm dần về hai.

**Chuyển sang Vũ**

> Đến đây là cách backend được triển khai và tăng số máy để nhận thêm yêu cầu. Khi nhiều yêu cầu cùng muốn giữ một ghế, tầng dữ liệu sẽ xử lý thế nào? Em mời Vũ trình bày phần này.

## Lê Duy Vũ · Slide 17–24

### Slide 17 — RDS PostgreSQL và ElastiCache Redis

*55 giây. Dùng ghế A12 làm ví dụ xuyên suốt.*

> Em là Vũ. Khi mở bán đông người, Redis điều tiết hàng đợi ảo trước checkout. Giả sử khách đến lượt và chọn ghế A12. Backend kiểm tra dòng dữ liệu của ghế và tạo đơn PENDING trong PostgreSQL, rồi dùng Redis giữ ghế tối đa 10 phút. Sau khi giữ ghế thành công, backend lưu vé gắn với đơn trong PostgreSQL. Khóa dòng PostgreSQL tồn tại trong lúc giao dịch chạy. Khóa Redis có thời hạn riêng để giữ chỗ khi khách chờ thanh toán. RDS dùng primary và standby ở hai AZ, còn Redis có primary và replica để dự phòng.

### Slide 18 — AWS Secrets Manager

*35 giây.*

> Backend cần mật khẩu PostgreSQL, thông tin xác thực Redis và các khóa ký của ứng dụng. Nhóm lưu các giá trị đó trong Secrets Manager. Khi EC2 khởi động, nó dùng IAM role đã gắn để đọc những secret được cấp quyền. Worker Lambda dùng một role riêng để đọc thông tin kết nối PostgreSQL. Nhờ đó, nhóm có thể quản lý quyền đọc bí mật theo đúng phần việc của từng thành phần.

### Slide 19 — EventBridge và Lambda

*55 giây. Đi theo sơ đồ rồi chỉ vào hai ô xử lý lỗi và kiểm tra kết quả.*

> Nếu khách bỏ dở, khóa Redis sẽ hết hạn theo TTL. Đơn và vé trong PostgreSQL vẫn cần được dọn theo quy tắc nghiệp vụ. EventBridge gọi Lambda mỗi 15 phút. Lambda đọc secret bằng IAM role và kết nối PostgreSQL qua cổng 5432. Worker chuyển đơn PENDING đã hết hạn sang EXPIRED, dọn vé thuộc đơn đó, giải phóng ghế bị khóa quá lâu và tắt voucher hết hạn hoặc hết lượt. Các câu SQL chạy trong một giao dịch, có lỗi thì hoàn tác giao dịch. Khi chạy thành công, log Maintenance completed cho biết số bản ghi đã xử lý.

### Slide 20 — CloudWatch và SNS

*50 giây. Chỉ ảnh lịch sử alarm trước, rồi ảnh email bên cạnh.*

> CloudWatch theo dõi CPU trung bình của cả Auto Scaling Group. Alarm vận hành yêu cầu cả ba kỳ, mỗi kỳ năm phút, đều vượt 70 phần trăm. Trong bài thử, ba giá trị lần lượt là 71,64 phần trăm, 99,99 phần trăm và 99,99 phần trăm. CloudWatch chuyển sang ALARM và gửi thông báo tới SNS. SNS chuyển thông báo qua email cho địa chỉ đã xác nhận. Lịch sử alarm và email là hai minh chứng trên slide. Việc điều chỉnh số lượng EC2 do chính sách Target Tracking của ASG thực hiện.

### Slide 21 — Kiểm thử tải trên /api/status

*35 giây.*

> Ngoài bài stress CPU, nhóm dùng ApacheBench gửi 2.000 yêu cầu tới endpoint /api/status, với độ đồng thời 50. Kết quả là khoảng 597 yêu cầu mỗi giây, p95 đạt 122 mili giây và không có yêu cầu lỗi trong lượt đo. Hiểu đơn giản, khoảng 95 phần trăm yêu cầu đo được có độ trễ tối đa 122 mili giây. Con số này mô tả endpoint kiểm tra trạng thái trong bài thử đó.

### Slide 22 — Dự toán chi phí AWS

*30 giây.*

> Theo AWS Pricing Calculator, môi trường demo dự toán khoảng 212 đô một tháng nếu chạy liên tục 730 giờ tại Singapore, trước VAT. Nhóm cũng lập một kịch bản production tham chiếu, khoảng 2.144 đô một tháng cho giả định 150.000 vé. Chi phí thực tế cần đối chiếu với thời gian chạy, mức sử dụng và hóa đơn của môi trường triển khai.

### Slide 23 — Kết quả triển khai

*30 giây. Chỉ lần lượt ảnh dashboard và ảnh soát vé.*

> Nhóm đã triển khai được luồng chọn ghế, giữ chỗ, thanh toán mô phỏng và nhận vé QR. Hai ảnh trên slide cho thấy dashboard của ban tổ chức và màn hình soát vé. Về hạ tầng, nhóm có minh chứng tăng từ hai lên bốn EC2, kiểm tra target healthy và nhận email khi alarm chuyển trạng thái.

### Slide 24 — Giới hạn và hướng phát triển

*40 giây. Kết thúc phần trình bày chính tại đây.*

> Phiên bản demo dùng thanh toán mô phỏng. Phần soát vé đã kiểm thử logic và API, còn nghiệm thu camera trên thiết bị thật là bước tiếp theo. Về cloud, bài stress CPU và bài đo /api/status cho hai góc nhìn khác nhau. Nhóm sẽ cần đo thêm luồng checkout đồng thời, đánh giá phương án NAT theo từng AZ và thử khôi phục để đo RPO và RTO. Nhóm em xin cảm ơn thầy cô và sẵn sàng trả lời câu hỏi.

## Phụ lục · Mở khi được hỏi

### Slide 25 — Đối chiếu 8 hạng mục đề cương

> Slide này ghép từng yêu cầu của đề cương với phần đã triển khai và vị trí ảnh minh chứng trong báo cáo. Nếu thầy cô hỏi về mạng và máy chủ private, nhóm em mở hình VPC và EC2. Nếu hỏi về dữ liệu, nhóm mở cấu hình RDS và Redis. Với co giãn hoặc cảnh báo, nhóm mở lịch sử ASG, CloudWatch và email SNS.

Tuấn trả lời phần mạng. Thành trả lời phần EC2, IAM, Terraform và co giãn. Vũ trả lời phần dữ liệu, cảnh báo và dự toán.
