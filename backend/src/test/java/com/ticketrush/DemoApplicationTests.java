package com.ticketrush;

import java.util.TimeZone;
import java.util.UUID;
import java.util.Map;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticketrush.model.entity.User;
import com.ticketrush.util.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "jwt.secret=test-jwt-secret-0123456789-abcdefghijklmnopqrstuvwxyz",
                "app.ticket.signing-secret=test-ticket-secret-0123456789-abcdefghijklmnopqrstuvwxyz"
        })
@AutoConfigureMockMvc
class DemoApplicationTests {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate db;
    @Autowired StringRedisTemplate cache;
    @Autowired JwtTokenProvider tokens;
    @Autowired com.ticketrush.service.VirtualQueueService queues;
    @org.springframework.boot.test.web.server.LocalServerPort int port;
    @Autowired org.springframework.context.ConfigurableApplicationContext context;
    @Autowired com.ticketrush.realtime.RealtimePublisher realtime;
    @Autowired org.springframework.messaging.simp.user.SimpUserRegistry wsUsers;

    static {
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Ho_Chi_Minh"));
    }

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @Container
    static GenericContainer<?> redis = new GenericContainer<>("redis:7")
            .withCommand("redis-server", "--notify-keyspace-events", "Ex", "--rename-command", "CONFIG", "")
            .withExposedPorts(6379);

    @DynamicPropertySource
    static void redisProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
        registry.add("spring.data.redis.ssl.enabled", () -> false);
    }

    @Test
    void contextLoads() {
        assertTrue(context.getBean(org.flywaydb.core.Flyway.class).getConfiguration().isGroup(),
                "Pending migrations must be published atomically during rolling upgrades");
        assertThrows(org.springframework.dao.DataAccessException.class, () -> cache.execute(
                (org.springframework.data.redis.core.RedisCallback<Object>) connection ->
                        connection.serverCommands().getConfig("notify-keyspace-events")));
    }

    record Fixture(String userToken, String staffToken, UUID userId, UUID showtime, List<UUID> seats) {}
    record ApiResult(int code, JsonNode body) {}

    JsonNode adminGet(String path, Fixture f) throws Exception {
        var response = mvc.perform(get(path).header("Authorization", "Bearer "+admin(f))).andReturn().getResponse();
        assertEquals(200, response.getStatus(), response.getContentAsString());
        return json.readTree(response.getContentAsString());
    }

    @Test
    void validationErrorsReturnStableFieldContract() throws Exception {
        var response = mvc.perform(post("/api/auth/register")
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"not-an-email\",\"password\":\"1\"}"))
                .andReturn().getResponse();

        assertEquals(400, response.getStatus());
        JsonNode body = json.readTree(response.getContentAsString());
        assertEquals("VALIDATION_FAILED", body.get("code").asText());
        assertTrue(body.get("fieldErrors").has("email"));
        assertTrue(body.get("fieldErrors").has("password"));
        assertTrue(body.get("fieldErrors").has("fullName"));
    }

    @Test
    void invalidBookingAndCatalogPayloadsAreRejectedWithFieldErrors() throws Exception {
        var f = fixture();

        var booking = postApi("/api/orders/checkout", f.userToken(), Map.of());
        assertEquals(400, booking.code());
        assertEquals("VALIDATION_FAILED", booking.body().get("code").asText());
        assertTrue(booking.body().get("fieldErrors").has("showtimeId"));
        assertTrue(booking.body().get("fieldErrors").has("seatIds"));

        var event = postApi("/api/admin/events", admin(f), Map.of("eventName", "No showtimes"));
        assertEquals(400, event.code());
        assertTrue(event.body().get("fieldErrors").has("showtimes"));

        var zone = postApi("/api/admin/showtimes/"+f.showtime()+"/zones", admin(f),
                Map.of("name", "bad", "price", 10, "matrixRow", 0, "matrixCol", 1));
        assertEquals(400, zone.code());
        assertTrue(zone.body().get("fieldErrors").has("matrixRow"));
    }

    @Test
    void malformedJsonReturnsStableErrorContract() throws Exception {
        var response = mvc.perform(post("/api/auth/login")
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{not-json"))
                .andReturn().getResponse();

        assertEquals(400, response.getStatus());
        JsonNode body = json.readTree(response.getContentAsString());
        assertEquals("INVALID_REQUEST", body.get("code").asText());
        assertNotNull(body.get("message"));
    }

    @Test
    void demoVouchersAreNotSeededByDefault() {
        assertEquals(0, db.queryForObject(
                "select count(*) from vouchers where code in ('RUSH100','SALE10','VIP50')", Integer.class));
    }

    @Test
    void overviewCountsCompletedRevenueOncePerMultiSeatOrder() throws Exception {
        var f = fixture();
        var before = adminGet("/api/admin/overview", f);
        db.update("update zones set price=5000000 where showtime_id=?", f.showtime());
        var pending = postApi("/api/orders/checkout", f.userToken(), Map.of("showtimeId", f.showtime(), "seatIds", f.seats()));
        assertEquals(200, pending.code());
        assertEquals(before.get("totalRevenue"), adminGet("/api/admin/overview", f).get("totalRevenue"));
        UUID id = UUID.fromString(pending.body().get("orderId").asText());
        assertEquals(200, confirm(f, id).code());
        var after = adminGet("/api/admin/overview", f);
        assertEquals(before.get("totalRevenue").asDouble()+10000000, after.get("totalRevenue").asDouble());
        assertEquals(before.get("totalTicketsSold").asLong()+2, after.get("totalTicketsSold").asLong());
        UUID event = db.queryForObject("select event_id from showtimes where id=?", UUID.class, f.showtime());
        var top = java.util.stream.StreamSupport.stream(after.get("topEvents").spliterator(), false)
                .filter(e -> e.get("id").asText().equals(event.toString())).findFirst().orElseThrow();
        assertEquals(10000000, top.get("revenue").asDouble());
        assertEquals(2, top.get("ticketsSold").asInt());
        assertEquals(100, top.get("occupancyRate").asDouble());
        assertEquals(403, mvc.perform(get("/api/admin/overview").header("Authorization", "Bearer "+f.userToken())).andReturn().getResponse().getStatus());
    }

    @Test
    void adminVoucherLifecyclePreservesOrderHistoryAndValidatesInputs() throws Exception {
        var f = fixture();
        String code = "V"+UUID.randomUUID().toString().replace("-", "").substring(0,12).toUpperCase();
        var request = Map.of("code",code,"discountType","PERCENT","discountValue",10,"expiresAt","2030-01-01T10:00:00+07:00");
        assertEquals(403, postApi("/api/admin/vouchers", f.userToken(), request).code());
        var created = postApi("/api/admin/vouchers", admin(f), request);
        assertEquals(201, created.code(), created.body().toString());
        String id = created.body().get("id").asText();
        assertEquals(403,mvc.perform(get("/api/admin/vouchers").header("Authorization","Bearer "+f.userToken())).andReturn().getResponse().getStatus());
        assertEquals(403,mvc.perform(patch("/api/admin/vouchers/"+id+"/toggle").header("Authorization","Bearer "+f.userToken())).andReturn().getResponse().getStatus());
        assertEquals(403,mvc.perform(delete("/api/admin/vouchers/"+id).header("Authorization","Bearer "+f.userToken())).andReturn().getResponse().getStatus());
        assertTrue(created.body().get("maxUsage").isNull());
        assertEquals("PERCENTAGE",created.body().get("discountType").asText());
        assertEquals(f.userId().toString(),created.body().get("createdBy").asText());
        assertEquals(409,postApi("/api/admin/vouchers",admin(f),request).code());
        assertEquals(400,postApi("/api/admin/vouchers",admin(f),Map.of("code","lowercase","discountType","PERCENT","discountValue",10)).code());
        assertEquals(400,postApi("/api/admin/vouchers",admin(f),Map.of("code","BADPERCENT","discountType","PERCENT","discountValue",101)).code());
        assertEquals(400,postApi("/api/admin/vouchers",admin(f),Map.of("code","BADQUOTA","discountType","FIXED","discountValue",100,"maxUsage",0)).code());
        assertEquals(400,postApi("/api/admin/vouchers",admin(f),Map.of("code","LONGDESC","discountType","FIXED","discountValue",100,"description","x".repeat(256))).code());
        assertEquals(400,postApi("/api/admin/vouchers",admin(f),Map.of("code","PASTDATE","discountType","FIXED","discountValue",100,"expiresAt","2000-01-01T00:00:00+07:00")).code());
        UUID order = checkout(f,0);
        assertEquals(200,postApi("/api/orders/checkout/"+order+"/apply-voucher",f.userToken(),Map.of("code",code)).code());
        assertEquals(200,confirm(f,order).code());
        var summary = java.util.stream.StreamSupport.stream(adminGet("/api/admin/vouchers",f).spliterator(),false)
                .filter(v -> v.get("id").asText().equals(id)).findFirst().orElseThrow();
        assertEquals(1,summary.get("usageCount").asInt()); assertEquals(10000,summary.get("totalSaved").asDouble());
        assertEquals(409,mvc.perform(delete("/api/admin/vouchers/"+id).header("Authorization","Bearer "+admin(f))).andReturn().getResponse().getStatus());
        assertEquals(200,mvc.perform(patch("/api/admin/vouchers/"+id+"/toggle").header("Authorization","Bearer "+admin(f))).andReturn().getResponse().getStatus());
        var customer=mvc.perform(get("/api/orders/vouchers").header("Authorization","Bearer "+f.userToken())).andReturn().getResponse();
        assertFalse(customer.getContentAsString().contains(code));
        String unused=postApi("/api/admin/vouchers",admin(f),Map.of("code",code+"X","discountType","FIXED","discountValue",1000,"maxUsage",2)).body().get("id").asText();
        assertEquals(204,mvc.perform(delete("/api/admin/vouchers/"+unused).header("Authorization","Bearer "+admin(f))).andReturn().getResponse().getStatus());
    }

    @Test
    void checkinStatsExcludeDraftsAndWrongShowtimeDoesNotConsumeTicket() throws Exception {
        var f=fixture(); var other=fixture(); UUID order=checkout(f,0);
        assertEquals(0,adminGet("/api/admin/checkin/stats/"+f.showtime(),f).get("totalTickets").asInt());
        assertEquals(200,confirm(f,order).code()); String qr=draftQr(order);
        var wrong=postApi("/api/checkin/scan",admin(f),Map.of("qrPayload",qr,"showtimeId",other.showtime()));
        assertEquals("WRONG_SHOWTIME",wrong.body().get("status").asText());
        assertEquals(0,adminGet("/api/admin/checkin/stats/"+f.showtime(),f).get("checkedIn").asInt());
        assertEquals(200,postApi("/api/checkin/scan",admin(f),Map.of("qrPayload",qr,"showtimeId",f.showtime())).code());
        var stats=adminGet("/api/admin/checkin/stats/"+f.showtime(),f);
        assertEquals(1,stats.get("totalTickets").asInt()); assertEquals(1,stats.get("checkedIn").asInt());
        assertEquals(0,stats.get("pendingEntry").asInt());
        assertEquals("ALREADY_CHECKED_IN",postApi("/api/checkin/scan",admin(f),Map.of("qrPayload",qr)).body().get("status").asText());
        assertEquals(403,mvc.perform(get("/api/admin/checkin/stats/"+f.showtime()).header("Authorization","Bearer "+f.userToken())).andReturn().getResponse().getStatus());
    }

    Fixture fixture() {
        UUID userId = UUID.randomUUID(), event = UUID.randomUUID(), showtime = UUID.randomUUID(), zone = UUID.randomUUID();
        db.update("insert into users(id,email,password,role) values(?,?,?,?)", userId, userId+"@test.invalid", "unused", "USER");
        db.update("insert into events(id,event_name,max_tickets_per_order) values(?,?,?)", event, "Regression", 4);
        db.update("insert into showtimes(id,event_id,start_time,end_time) values(?,?,NOW()+INTERVAL '1 day',NOW()+INTERVAL '26 hours')", showtime, event);
        db.update("insert into zones(id,showtime_id,name,price) values(?,?,?,?)", zone, showtime, "Test", 100000.0);
        List<UUID> seats = List.of(UUID.randomUUID(), UUID.randomUUID());
        for (UUID seat : seats) db.update("insert into seats(id,zone_id,status,seat_label) values(?,?,?,?)", seat, zone, "AVAILABLE", "A1");
        User user = new User(); user.setId(userId); user.setRole("USER");
        String userToken = tokens.generateToken(user);
        user.setRole("STAFF");
        return new Fixture(userToken, tokens.generateToken(user), userId, showtime, seats);
    }

    ApiResult postApi(String path, String token, Object body) throws Exception {
        var response = mvc.perform(post(path).header("Authorization", "Bearer "+token)
                .contentType("application/json").content(json.writeValueAsString(body))).andReturn().getResponse();
        String content = response.getContentAsString();
        return new ApiResult(response.getStatus(), content.isBlank() ? json.nullNode() : json.readTree(content));
    }

    UUID checkout(Fixture f, int seat) throws Exception {
        var result = postApi("/api/orders/checkout", f.userToken(), Map.of("showtimeId", f.showtime(), "seatIds", List.of(f.seats().get(seat))));
        assertEquals(200, result.code(), result.body().toString());
        assertTrue(result.body().at("/selectedSeats/0/qrPayload").isNull());
        return UUID.fromString(result.body().get("orderId").asText());
    }

    String draftQr(UUID order) {
        return db.queryForObject("select qr_payload from tickets where order_id=?", String.class, order);
    }

    ApiResult confirm(Fixture f, UUID order) throws Exception {
        return postApi("/api/orders/checkout/"+order+"/confirm", f.userToken(), Map.of());
    }

    List<ApiResult> parallel(Callable<ApiResult> first, Callable<ApiResult> second) throws Exception {
        var executor = Executors.newFixedThreadPool(2);
        var start = new CountDownLatch(1);
        try {
            var a = executor.submit(() -> { start.await(); return first.call(); });
            var b = executor.submit(() -> { start.await(); return second.call(); });
            start.countDown();
            return List.of(a.get(15, TimeUnit.SECONDS), b.get(15, TimeUnit.SECONDS));
        } finally {
            executor.shutdownNow();
        }
    }

    String admin(Fixture f) {
        User user = new User(); user.setId(f.userId()); user.setRole("ADMIN");
        return tokens.generateToken(user);
    }

    UUID event(Fixture f) {
        return db.queryForObject("select event_id from showtimes where id=?", UUID.class, f.showtime());
    }

    UUID zone(Fixture f) {
        return db.queryForObject("select zone_id from seats where id=?", UUID.class, f.seats().get(0));
    }

    @Test
    void upgradesExistingV6DatabaseAndPreservesLegacyCancellation() throws Exception {
        String schema="upgrade_"+UUID.randomUUID().toString().replace("-","");
        var old=org.flywaydb.core.Flyway.configure()
                .dataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword())
                .schemas(schema).group(true).target("6").load();
        try {
            old.migrate();
            assertEquals("6",old.info().current().getVersion().toString());
            var f=fixture();var order=checkout(f,0);
            db.update("insert into "+schema+".users select * from users where id=?",f.userId());
            db.update("insert into "+schema+".events select * from events where id=?",event(f));
            db.update("insert into "+schema+".showtimes select * from showtimes where id=?",f.showtime());
            db.update("insert into "+schema+".zones select * from zones where id=?",zone(f));
            db.update("insert into "+schema+".seats select * from seats where id=?",f.seats().get(0));
            db.update("insert into "+schema+".orders select * from orders where id=?",order);
            db.update("insert into "+schema+".tickets select * from tickets where order_id=?",order);
            var upgraded=org.flywaydb.core.Flyway.configure()
                    .dataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword())
                    .schemas(schema).group(true).load();
            upgraded.migrate();upgraded.validate();
            assertEquals("8",upgraded.info().current().getVersion().toString());
            try(var connection=java.sql.DriverManager.getConnection(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword())) {
                connection.setSchema(schema);connection.setAutoCommit(false);
                try(var statement=connection.prepareStatement("delete from tickets where order_id=?")) {
                    statement.setObject(1,order);assertEquals(1,statement.executeUpdate());
                }
                try(var statement=connection.prepareStatement("update orders set status='EXPIRED' where id=?")) {
                    statement.setObject(1,order);statement.executeUpdate();
                }
                connection.commit();
            }
            assertEquals("EXPIRED",db.queryForObject("select status from "+schema+".orders where id=?",String.class,order));
        } finally {
            db.execute("drop schema if exists "+schema+" cascade");
        }
    }

    @Test
    void legacyDeleteThenExpireCommitsWithoutWeakeningLiveCheckoutProtection() throws Exception {
        var f=fixture(); var order=checkout(f,0);
        db.execute((org.springframework.jdbc.core.ConnectionCallback<Void>) connection -> {
            connection.setAutoCommit(false);
            try {
                try(var delete=connection.prepareStatement("delete from tickets where order_id=?")) {
                    delete.setObject(1,order); assertEquals(1,delete.executeUpdate());
                }
                try(var expire=connection.prepareStatement("update orders set status='EXPIRED' where id=?")) {
                    expire.setObject(1,order); assertEquals(1,expire.executeUpdate());
                }
                connection.commit();
            } finally { connection.rollback(); connection.setAutoCommit(true); }
            return null;
        });
        assertEquals("EXPIRED",db.queryForObject("select status from orders where id=?",String.class,order));
        assertEquals(0,db.queryForObject("select count(*) from tickets where order_id=?",Integer.class,order));
        var second=checkout(f,1);
        assertThrows(org.springframework.dao.DataAccessException.class,()->db.update("delete from tickets where order_id=?",second));
        assertEquals(1,db.queryForObject("select count(*) from tickets where order_id=?",Integer.class,second));
    }

    @Test
    void deferredDeleteCannotCommitAnOrderAsPaidWithoutTickets() throws Exception {
        var f=fixture(); var order=checkout(f,0);
        db.execute((org.springframework.jdbc.core.ConnectionCallback<Void>) connection -> {
            connection.setAutoCommit(false);
            try {
                try(var statement=connection.prepareStatement("delete from tickets where order_id=?")) {
                    statement.setObject(1,order); statement.executeUpdate();
                }
                try(var statement=connection.prepareStatement("update orders set status='COMPLETED' where id=?")) {
                    statement.setObject(1,order); statement.executeUpdate();
                }
                var failure=assertThrows(java.sql.SQLException.class,connection::commit);
                assertEquals("23514",failure.getSQLState());
            } finally { connection.rollback(); connection.setAutoCommit(true); }
            return null;
        });
        assertEquals("PENDING",db.queryForObject("select status from orders where id=?",String.class,order));
        assertEquals(1,db.queryForObject("select count(*) from tickets where order_id=?",Integer.class,order));
        assertEquals(200,confirm(f,order).code());
        assertThrows(org.springframework.dao.DataAccessException.class,()->db.update("delete from tickets where order_id=?",order));
    }

    @Test
    void revenueTimelineUsesVietnamMidnightForEventAndShowtime() throws Exception {
        var f=fixture(); var first=checkout(f,0);var second=checkout(f,1);
        assertEquals(200,confirm(f,first).code());assertEquals(200,confirm(f,second).code());
        db.update("update orders set created_at=TIMESTAMP '2026-11-16 16:59:59' where id=?",first);
        db.update("update orders set created_at=TIMESTAMP '2026-11-16 17:00:00' where id=?",second);
        for(String path:List.of("/api/admin/events/"+event(f)+"/analytics","/api/admin/events/showtimes/"+f.showtime()+"/analytics")) {
            var response=mvc.perform(get(path).header("Authorization","Bearer "+admin(f))).andReturn().getResponse();
            assertEquals(200,response.getStatus());var result=json.readTree(response.getContentAsString());
            assertEquals(200000.0,result.get("totalRevenue").asDouble());
            var points=result.get("revenueTimeline");assertEquals(2,points.size());
            assertEquals("16/11",points.get(0).get("label").asText());assertEquals("17/11",points.get(1).get("label").asText());
            assertEquals(100000.0,points.get(0).get("revenue").asDouble());assertEquals(100000.0,points.get(1).get("revenue").asDouble());
        }
    }

    @Test
    void preservesPaidTicketsAndAuditAcrossCatalogDeletion() throws Exception {
        var f = fixture(); var order = checkout(f, 0);
        assertEquals(200, confirm(f, order).code());
        assertEquals(200, postApi("/api/checkin/scan", f.staffToken(), Map.of("qrPayload", draftQr(order))).code());
        for (String path : List.of("/api/admin/events/"+event(f),
                "/api/admin/showtimes/"+f.showtime()+"/zones/"+zone(f))) {
            assertEquals(400, mvc.perform(delete(path).header("Authorization", "Bearer "+admin(f)))
                    .andReturn().getResponse().getStatus());
        }
        assertThrows(org.springframework.dao.DataAccessException.class,
                () -> db.update("delete from tickets where order_id=?", order));
        assertEquals(1, db.queryForObject("select count(*) from tickets where order_id=?", Integer.class, order));
        assertEquals(1, db.queryForObject("select count(*) from ticket_checkins c join tickets t on t.id=c.ticket_id where t.order_id=?", Integer.class, order));
        assertEquals("ALREADY_CHECKED_IN", postApi("/api/checkin/scan", f.staffToken(),
                Map.of("qrPayload", draftQr(order))).body().get("status").asText());
    }

    @Test
    void protectsLiveCheckoutButAllowsExpiredDraftCatalogDeletion() throws Exception {
        var f = fixture(); var order = checkout(f, 0); var id = event(f);
        assertEquals(400, mvc.perform(delete("/api/admin/events/"+id).header("Authorization", "Bearer "+admin(f)))
                .andReturn().getResponse().getStatus());
        assertThrows(org.springframework.dao.DataAccessException.class,
                () -> db.update("delete from tickets where order_id=?", order));
        db.update("update orders set expires_at=NOW()-INTERVAL '1 day' where id=?", order);
        assertEquals(204, mvc.perform(delete("/api/admin/events/"+id).header("Authorization", "Bearer "+admin(f)))
                .andReturn().getResponse().getStatus());
    }

    @Test
    void patchPreservesOmittedRootAndNestedFieldsAndAllowsExplicitNull() throws Exception {
        var f = fixture(); var id = event(f);
        db.update("update events set description='keep',venue_name='venue',max_tickets_per_order=1 where id=?", id);
        db.update("update showtimes set name='show',start_time=?,end_time=? where id=?",
                java.time.LocalDateTime.now().plusDays(1), java.time.LocalDateTime.now().plusDays(2), f.showtime());
        var body = Map.of("coverImage", "new", "showtimes", List.of(Map.of("id", f.showtime(), "name", "renamed")),
                "showtimeIdForZones", f.showtime(), "zones", List.of(Map.of("id", zone(f), "name", "renamed")));
        var response = mvc.perform(patch("/api/admin/events/"+id).header("Authorization", "Bearer "+admin(f))
                .contentType("application/json").content(json.writeValueAsString(body))).andReturn().getResponse();
        assertEquals(200, response.getStatus(), response.getContentAsString());
        var result = json.readTree(response.getContentAsString());
        assertEquals("keep", result.get("description").asText());
        assertEquals("venue", result.get("venueName").asText());
        assertEquals(1, result.get("maxTicketsPerOrder").asInt());
        assertEquals(100000.0, db.queryForObject("select price from zones where id=?", Double.class, zone(f)));
        assertNotNull(db.queryForObject("select start_time from showtimes where id=?", java.sql.Timestamp.class, f.showtime()));
        assertEquals(200, mvc.perform(patch("/api/admin/events/"+id).header("Authorization", "Bearer "+admin(f))
                .contentType("application/json").content("{\"description\":null}" )).andReturn().getResponse().getStatus());
        assertNull(db.queryForObject("select description from events where id=?", String.class, id));
    }

    @Test
    void rejectsNegativePricesOnAllCatalogWriteRoutesAndDatabase() throws Exception {
        var f = fixture(); var id = event(f); var token = admin(f);
        assertEquals(400, postApi("/api/admin/events", token, Map.of("eventName", "Invalid",
                "zones", List.of(Map.of("price", -1)))).code());
        assertEquals(400, postApi("/api/admin/showtimes/"+f.showtime()+"/zones", token,
                Map.of("name", "bad", "price", -1, "matrixRow", 1, "matrixCol", 1)).code());
        var body = Map.of("showtimeIdForZones", f.showtime(), "zones", List.of(Map.of("id", zone(f), "price", -1)));
        for (var method : List.of(patch("/api/admin/events/"+id), put("/api/admin/events/"+id))) {
            assertEquals(400, mvc.perform(method.header("Authorization", "Bearer "+token)
                    .contentType("application/json").content(json.writeValueAsString(body))).andReturn().getResponse().getStatus());
        }
        for (double invalid : new double[]{-1, Double.NaN, Double.POSITIVE_INFINITY}) {
            assertThrows(org.springframework.dao.DataAccessException.class,
                    () -> db.update("update zones set price=? where id=?", invalid, zone(f)));
        }
        db.update("update zones set price=0 where id=?", zone(f));
        var order = checkout(f, 0);
        assertThrows(org.springframework.dao.DataAccessException.class,
                () -> db.update("update orders set total_price=-1 where id=?", order));
        assertEquals(200, confirm(f, order).code());
    }

    @Test
    void unlockBroadcastsOnlyWhenItsOwnLockWasDeleted() {
        var f = fixture(); var seat = f.seats().get(0);
        String key = "lock:seat:"+f.showtime()+":"+seat;
        var service = new com.ticketrush.service.SeatLockService();
        var publisher = org.mockito.Mockito.mock(com.ticketrush.realtime.RealtimePublisher.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "redisTemplate", cache);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "realtimePublisher", publisher);
        cache.opsForValue().set(key, "someone-else");
        service.unlockSeats(f.showtime(), List.of(seat), f.userId().toString());
        assertEquals("someone-else", cache.opsForValue().get(key));
        org.mockito.Mockito.verifyNoInteractions(publisher);
        cache.opsForValue().set(key, f.userId()+":"+UUID.randomUUID());
        service.unlockSeats(f.showtime(), List.of(seat), f.userId().toString());
        assertNull(cache.opsForValue().get(key));
        service.unlockSeats(f.showtime(), List.of(seat), f.userId().toString());
        org.mockito.Mockito.verify(publisher).publish(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any());
        org.mockito.Mockito.verifyNoMoreInteractions(publisher);
    }

    @ParameterizedTest
    @ValueSource(booleans={true, false})
    void unlockDoesNotDeleteReplacementLockOrBroadcast(boolean sameUser) {
        var f = fixture(); var seat = f.seats().get(0);
        String key = "lock:seat:"+f.showtime()+":"+seat;
        String observed = f.userId()+":"+UUID.randomUUID();
        String replacement = (sameUser ? f.userId() : UUID.randomUUID())+":"+UUID.randomUUID();
        cache.opsForValue().set(key, observed);
        @SuppressWarnings("unchecked")
        org.springframework.data.redis.core.ValueOperations<String,String> values = org.mockito.Mockito.mock(org.springframework.data.redis.core.ValueOperations.class);
        org.mockito.Mockito.when(values.get(key)).thenAnswer(call -> {
            String value = cache.opsForValue().get(key);
            cache.opsForValue().set(key, replacement);
            return value;
        });
        var raced = new StringRedisTemplate(cache.getConnectionFactory()) {
            @Override public org.springframework.data.redis.core.ValueOperations<String,String> opsForValue() { return values; }
        };
        var service = new com.ticketrush.service.SeatLockService();
        var publisher = org.mockito.Mockito.mock(com.ticketrush.realtime.RealtimePublisher.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "redisTemplate", raced);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "realtimePublisher", publisher);
        service.unlockSeats(f.showtime(), List.of(seat), f.userId().toString());
        assertEquals(replacement, cache.opsForValue().get(key));
        org.mockito.Mockito.verifyNoInteractions(publisher);
        cache.delete(key);
    }

    @Test
    void ticketPriceSnapshotSurvivesCatalogEditsAndVoucherDiscounts() throws Exception {
        var f = fixture();
        var result = postApi("/api/orders/checkout", f.userToken(), Map.of("showtimeId",f.showtime(),"seatIds",f.seats()));
        assertEquals(200, result.code()); var order = UUID.fromString(result.body().get("orderId").asText());
        db.update("update zones set price=900000 where id=?", zone(f));
        var pending = mvc.perform(get("/api/orders/checkout/"+order).header("Authorization","Bearer "+f.userToken()))
                .andReturn().getResponse();
        assertEquals(100000.0, json.readTree(pending.getContentAsString()).at("/selectedSeats/0/price").asDouble());
        UUID voucher = UUID.randomUUID(); String code = "P-"+voucher;
        db.update("insert into vouchers(id,code,discount_type,discount_value,total_quantity,used_quantity,active) values(?,?,?,1000,10,0,true)",voucher,code,"FIXED_AMOUNT");
        assertEquals(200,postApi("/api/orders/checkout/"+order+"/apply-voucher", f.userToken(),Map.of("code",code)).code());
        var completed = confirm(f,order);
        assertEquals(200,completed.code()); assertEquals(199000.0,completed.body().get("totalPrice").asDouble());
        for (var ticket : completed.body().get("selectedSeats")) assertEquals(100000.0,ticket.get("price").asDouble());
        db.update("update zones set price=5000 where id=?",zone(f));
        var wallet = mvc.perform(get("/api/orders/my-tickets").header("Authorization","Bearer "+f.userToken())).andReturn().getResponse();
        var issued = json.readTree(wallet.getContentAsString()).get(0);
        assertEquals(199000.0,issued.get("totalPrice").asDouble());
        for (var ticket : issued.get("tickets")) assertEquals(100000.0,ticket.get("price").asDouble());
        assertEquals(java.time.ZoneOffset.ofHours(7),java.time.OffsetDateTime.parse(issued.get("startTime").asText()).getOffset());
        for (double invalid : new double[]{-1,Double.NaN,Double.POSITIVE_INFINITY}) {
            assertThrows(org.springframework.dao.DataAccessException.class,()->db.update("update tickets set unit_price=? where order_id=?",invalid,order));
        }
    }

    @Test
    void unknownLegacyTicketPricesDoNotUseCurrentCatalog() throws Exception {
        var f=fixture(); var order=checkout(f,0);
        db.update("update tickets set unit_price=NULL where order_id=?",order);
        db.update("update zones set price=999999 where id=?",zone(f));
        var result=confirm(f,order);
        assertEquals(200,result.code()); assertTrue(result.body().at("/selectedSeats/0/price").isNull());
        assertEquals(100000.0,result.body().get("totalPrice").asDouble());
    }

    @Test
    void closedShowtimeRejectsBothCheckoutAndLegacySeatRoutes() throws Exception {
        var f=fixture(); db.update("update showtimes set start_time=NOW()-INTERVAL '2 days',end_time=NOW()-INTERVAL '1 day' where id=?",f.showtime());
        var request=Map.of("showtimeId",f.showtime(),"seatIds",f.seats());
        for (String route:List.of("/api/orders/checkout","/api/events/seats/lock","/api/events/seats/confirm")) {
            assertEquals(400,postApi(route,f.userToken(),request).code());
        }
        assertEquals(0,db.queryForObject("select count(*) from orders where user_id=?",Integer.class,f.userId()));
        assertFalse(Boolean.TRUE.equals(cache.hasKey("lock:seat:"+f.showtime()+":"+f.seats().get(0))));
    }

    @Test
    void confirmationExpiresCheckoutWhenShowtimeWasMovedIntoPast() throws Exception {
        var f=fixture(); var order=checkout(f,0); UUID voucher=UUID.randomUUID(); String code="C-"+voucher;
        db.update("insert into vouchers(id,code,discount_type,discount_value,total_quantity,used_quantity,active) values(?,?,?,1000,10,0,true)",voucher,code,"FIXED_AMOUNT");
        assertEquals(200,postApi("/api/orders/checkout/"+order+"/apply-voucher",f.userToken(),Map.of("code",code)).code());
        db.update("update showtimes set start_time=NOW()-INTERVAL '1 day' where id=?",f.showtime());
        var result=confirm(f,order); assertEquals(200,result.code());
        assertEquals("EXPIRED",result.body().get("status").asText()); assertTrue(result.body().get("selectedSeats").isEmpty());
        assertEquals(0,db.queryForObject("select count(*) from tickets where order_id=?",Integer.class,order));
        assertEquals(0,db.queryForObject("select used_quantity from vouchers where id=?",Integer.class,voucher));
        assertFalse(Boolean.TRUE.equals(cache.hasKey("lock:seat:"+f.showtime()+":"+f.seats().get(0))));
    }

    @Test
    void checkoutDeadlineCannotExtendBeyondShowtimeStart() throws Exception {
        var f=fixture(); db.update("update showtimes set start_time=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')+INTERVAL '3 minutes' where id=?",f.showtime());
        var result=postApi("/api/orders/checkout",f.userToken(),Map.of("showtimeId",f.showtime(),"seatIds",f.seats()));
        assertEquals(200,result.code());
        assertEquals(java.time.OffsetDateTime.parse(result.body().at("/showtime/startTime").asText()).toInstant(),
                java.time.OffsetDateTime.parse(result.body().get("expiresAt").asText()).toInstant());
    }

    @Test
    void showtimeOffsetsRoundTripThroughLocalOffsetAndUtcAdminInputs() throws Exception {
        var f=fixture(); var start=java.time.LocalDateTime.now(com.ticketrush.util.EventTime.ZONE).plusDays(10).withNano(0);
        var end=start.plusHours(2);
        var created=postApi("/api/admin/events",admin(f),Map.of("eventName","Offset test","showtimes",List.of(Map.of("name","Show","startTime",start.toString(),"endTime",end.toString()))));
        assertEquals(200,created.code());
        var wire=created.body().at("/showtimes/0/startTime").asText(); var offset=java.time.OffsetDateTime.parse(wire);
        assertEquals(java.time.ZoneOffset.ofHours(7),offset.getOffset()); assertEquals(start,offset.toLocalDateTime());
        var id=created.body().get("id").asText(); var sid=created.body().at("/showtimes/0/id").asText();
        for (String input:List.of(wire,offset.toInstant().toString(),start.toString())) {
            var body=Map.of("showtimes",List.of(Map.of("id",sid,"startTime",input,"endTime",end.toString())));
            var response=mvc.perform(patch("/api/admin/events/"+id).header("Authorization","Bearer "+admin(f))
                    .contentType("application/json").content(json.writeValueAsString(body))).andReturn().getResponse();
            assertEquals(200,response.getStatus(),response.getContentAsString());
            assertEquals(offset.toInstant(),java.time.OffsetDateTime.parse(json.readTree(response.getContentAsString()).at("/showtimes/0/startTime").asText()).toInstant());
        }
    }

    @ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({"0,0","-1,0","2,2","10,3"})
    void queueBatchSizeValidationAndCapacityLimit(int batch,int expected) throws Exception {
        var config=new org.springframework.data.redis.connection.RedisStandaloneConfiguration(redis.getHost(),redis.getMappedPort(6379));
        config.setDatabase(1); // Scheduler and application listeners use database 0.
        var factory=new org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory(config);
        factory.afterPropertiesSet();
        try {
            var isolated=new StringRedisTemplate(factory);
            var service=new com.ticketrush.service.VirtualQueueService();
            org.springframework.test.util.ReflectionTestUtils.setField(service,"redisTemplate",isolated);
            org.springframework.test.util.ReflectionTestUtils.setField(service,"realtimePublisher",org.mockito.Mockito.mock(com.ticketrush.realtime.RealtimePublisher.class));
            var sid=UUID.randomUUID(); var wait="queue:waiting:"+sid;
            var batchKey="queue:batchSize:"+sid;
            isolated.opsForValue().set("queue:maxCapacity:"+sid,"3");
            isolated.opsForValue().set(batchKey,Integer.toString(batch));
            for(int i=0;i<5;i++) isolated.opsForZSet().add(wait,"probe-"+i,i);
            assertEquals(expected,service.grantNextBatch(sid));
            assertEquals(5-expected,isolated.opsForZSet().size(wait));
            assertEquals(expected,service.getActiveCount(sid));
            if(batch<=0) {
                assertThrows(IllegalArgumentException.class,()->service.setBatchSize(sid,batch));
                var f=fixture();
                assertEquals(400,postApi("/api/queue/admin/set-batch-size?showtimeId="+sid+"&batchSize="+batch,admin(f),Map.of()).code());
            }
            isolated.delete(List.of(wait,batchKey,"queue:active:"+sid,"queue:maxCapacity:"+sid));
            for(int i=0;i<5;i++) isolated.delete("queue:pass:"+sid+":probe-"+i);
        } finally {
            factory.destroy();
        }
    }

    @Test
    void restrictsCheckinAndIssuesSignedQrOnlyAfterCompletion() throws Exception {
        var f = fixture(); var order = checkout(f, 0); String qr = draftQr(order);
        var scan = Map.of("qrPayload", qr);
        assertEquals(403, postApi("/api/checkin/scan", f.userToken(), scan).code());
        var unpaid = postApi("/api/checkin/scan", f.staffToken(), scan);
        assertEquals(400, unpaid.code());
        assertEquals("ORDER_NOT_COMPLETED", unpaid.body().get("status").asText());
        var complete = confirm(f, order);
        assertEquals(200, complete.code());
        assertEquals(qr, complete.body().at("/selectedSeats/0/qrPayload").asText());
        var recovered = mvc.perform(get("/api/orders/checkout/"+order).header("Authorization", "Bearer "+f.userToken()))
                .andReturn().getResponse();
        assertEquals(200, recovered.getStatus());
        assertEquals(qr, json.readTree(recovered.getContentAsString()).at("/selectedSeats/0/qrPayload").asText());
        assertEquals(200, postApi("/api/checkin/scan", f.staffToken(), scan).code());
    }

    @Test
    void onlyOneConcurrentScanSucceeds() throws Exception {
        var f = fixture(); var order = checkout(f, 0); assertEquals(200, confirm(f, order).code());
        var scan = Map.of("qrPayload", draftQr(order));
        var results = parallel(() -> postApi("/api/checkin/scan", f.staffToken(), scan),
                () -> postApi("/api/checkin/scan", f.staffToken(), scan));
        assertEquals(1, results.stream().filter(r -> r.code()==200 && r.body().get("status").asText().equals("CHECKED_IN")).count());
        assertEquals(1, results.stream().filter(r -> r.code()==400 && r.body().get("status").asText().equals("ALREADY_CHECKED_IN")).count());
    }

    @Test
    void onlyOneConcurrentOrderConsumesLastVoucherAndConfirmIsIdempotent() throws Exception {
        var f = fixture(); UUID first = checkout(f, 0), second = checkout(f, 1), voucher = UUID.randomUUID();
        String code = "R-"+voucher.toString().substring(0,8);
        db.update("insert into vouchers(id,code,discount_type,discount_value,total_quantity,used_quantity,active) values(?,?,?,1000,1,0,true)", voucher, code, "FIXED_AMOUNT");
        for (UUID order : List.of(first, second)) assertEquals(200,
                postApi("/api/orders/checkout/"+order+"/apply-voucher", f.userToken(), Map.of("code",code)).code());
        var results = parallel(() -> confirm(f, first), () -> confirm(f, second));
        assertEquals(1, results.stream().filter(r -> r.code()==200).count());
        assertEquals(1, results.stream().filter(r -> r.code()==400).count());
        assertEquals(1, db.queryForObject("select used_quantity from vouchers where id=?", Integer.class, voucher));
        UUID winner = UUID.fromString(results.stream().filter(r -> r.code()==200).findFirst().orElseThrow().body().get("orderId").asText());
        assertEquals(200, confirm(f, winner).code());
        assertEquals(1, db.queryForObject("select used_quantity from vouchers where id=?", Integer.class, voucher));
    }

    @ParameterizedTest
    @ValueSource(strings={"expired", "inactive"})
    void revalidatesVoucherAtConfirmation(String condition) throws Exception {
        var f = fixture(); UUID order = checkout(f, 0), voucher = UUID.randomUUID();
        String code="R-"+voucher.toString().substring(0,8);
        db.update("insert into vouchers(id,code,discount_type,discount_value,total_quantity,used_quantity,active) values(?,?,?,1000,1,0,true)", voucher, code, "FIXED_AMOUNT");
        assertEquals(200, postApi("/api/orders/checkout/"+order+"/apply-voucher", f.userToken(), Map.of("code",code)).code());
        if (condition.equals("expired")) db.update("update vouchers set end_date=NOW()-INTERVAL '1 day' where id=?", voucher);
        else db.update("update vouchers set active=false where id=?", voucher);
        assertEquals(400, confirm(f, order).code());
        assertEquals("PENDING", db.queryForObject("select status from orders where id=?", String.class, order));
        assertEquals(0, db.queryForObject("select used_quantity from vouchers where id=?", Integer.class, voucher));
        assertEquals("AVAILABLE", db.queryForObject("select status from seats where id=?", String.class, f.seats().get(0)));
    }

    @ParameterizedTest
    @ValueSource(strings={"get", "confirm", "apply-voucher", "remove-voucher"})
    void expirationCommitsAndReleasesLocks(String operation) throws Exception {
        var f=fixture(); UUID order=checkout(f,0);
        db.update("update orders set expires_at=NOW()-INTERVAL '1 day' where id=?", order);
        String path="/api/orders/checkout/"+order;
        JsonNode response;
        if (operation.equals("get")) {
            var result=mvc.perform(get(path).header("Authorization", "Bearer "+f.userToken())).andReturn().getResponse();
            assertEquals(200,result.getStatus()); response=json.readTree(result.getContentAsString());
        } else {
            var result=postApi(path+"/"+operation,f.userToken(),Map.of("code","unused"));
            assertEquals(200,result.code()); response=result.body();
        }
        assertEquals("EXPIRED",response.get("status").asText());
        assertEquals(0,response.get("selectedSeats").size());
        assertEquals("EXPIRED",db.queryForObject("select status from orders where id=?",String.class,order));
        assertEquals(0,db.queryForObject("select count(*) from tickets where order_id=?",Integer.class,order));
        assertFalse(Boolean.TRUE.equals(cache.hasKey("lock:seat:"+f.showtime()+":"+f.seats().get(0))));
    }

    @Test
    void rejectsDirectCheckoutWithoutQueuePass() throws Exception {
        var f=fixture();
        cache.opsForValue().set("queue:threshold:"+f.showtime(),"0");
        var body=Map.of("showtimeId",f.showtime(),"seatIds",List.of(f.seats().get(0)));
        var rejected=postApi("/api/orders/checkout",f.userToken(),body);
        assertEquals(400,rejected.code());
        assertTrue(rejected.body().get("message").asText().contains("QUEUE_ACCESS_REQUIRED"));
        assertEquals(0,db.queryForObject("select count(*) from orders where user_id=?",Integer.class,f.userId()));
        cache.opsForValue().set("queue:pass:"+f.showtime()+":"+f.userId(),"1");
        assertEquals(200,postApi("/api/orders/checkout",f.userToken(),body).code());
    }

    @ParameterizedTest
    @ValueSource(strings={"checkout", "lock", "confirm"})
    void directBookingReservesAdmissionAndRejectsNextUserAtThreshold(String operation) throws Exception {
        var first = fixture();
        var second = fixture();
        queues.setThreshold(first.showtime(), 1);
        UUID order = checkout(first, 0); // No queue/status request before checkout.
        assertEquals(1, queues.getActiveCount(first.showtime()));
        assertTrue(queues.hasValidPass(first.showtime(), first.userId().toString()));
        assertEquals(200, postApi("/api/events/seats/lock", first.userToken(),
                Map.of("showtimeId", first.showtime(), "seatIds", List.of(first.seats().get(0)))).code());
        assertEquals(1, queues.getActiveCount(first.showtime()), "Retries cannot reserve a second slot");

        String path = operation.equals("checkout") ? "/api/orders/checkout" : "/api/events/seats/"+operation;
        var rejected = postApi(path, second.userToken(),
                Map.of("showtimeId", first.showtime(), "seatIds", List.of(first.seats().get(1))));
        if (operation.equals("lock")) {
            assertEquals(200, rejected.code());
            assertFalse(rejected.body().get("success").asBoolean());
            assertEquals("QUEUE_ACCESS_REQUIRED", rejected.body().get("message").asText());
        } else {
            assertEquals(400, rejected.code());
            assertTrue(rejected.body().get("message").asText().contains("QUEUE_ACCESS_REQUIRED"));
        }
        assertFalse(queues.hasValidPass(first.showtime(), second.userId().toString()));
        assertFalse(Boolean.TRUE.equals(cache.hasKey("lock:seat:"+first.showtime()+":"+first.seats().get(1))));
        assertEquals(0, db.queryForObject("select count(*) from orders where user_id=?", Integer.class, second.userId()));
        assertEquals(204, postApi("/api/orders/checkout/"+order+"/cancel", first.userToken(), Map.of()).code());
        assertEquals(0, queues.getActiveCount(first.showtime()));
    }

    @Test
    void legacyBookingRejectsWrongShowtimeQuotaAndBlockedSeats() throws Exception {
        var f=fixture();
        var wrong=Map.of("showtimeId",UUID.randomUUID(),"seatIds",List.of(f.seats().get(0)));
        for (String operation : List.of("lock","confirm")) {
            assertEquals(400,postApi("/api/events/seats/"+operation,f.userToken(),wrong).code());
        }
        db.update("update events set max_tickets_per_order=1 where id=(select event_id from showtimes where id=?)",f.showtime());
        var tooMany=Map.of("showtimeId",f.showtime(),"seatIds",f.seats());
        for (String operation : List.of("lock","confirm")) {
            assertEquals(400,postApi("/api/events/seats/"+operation,f.userToken(),tooMany).code());
        }
        db.update("update seats set status='AISLE' where id=?",f.seats().get(0));
        var blocked=Map.of("showtimeId",f.showtime(),"seatIds",List.of(f.seats().get(0)));
        assertEquals(400,postApi("/api/events/seats/lock",f.userToken(),blocked).code());
        assertEquals(0,db.queryForObject("select count(*) from orders where user_id=?",Integer.class,f.userId()));
    }

    @Test
    void legacyConfirmationUsesCheckoutAdmissionAndSignedTickets() throws Exception {
        var f=fixture(); var body=Map.of("showtimeId",f.showtime(),"seatIds",List.of(f.seats().get(0)));
        cache.opsForValue().set("queue:threshold:"+f.showtime(),"0");
        assertEquals(400,postApi("/api/events/seats/confirm",f.userToken(),body).code());
        cache.opsForValue().set("queue:pass:"+f.showtime()+":"+f.userId(),"1");
        cache.opsForValue().set("queue:active:"+f.showtime(),"1");
        assertTrue(postApi("/api/events/seats/lock",f.userToken(),body).body().get("success").asBoolean());
        var confirmed=postApi("/api/events/seats/confirm",f.userToken(),body);
        assertEquals(200,confirmed.code(),confirmed.body().toString());
        assertTrue(confirmed.body().get("success").asBoolean());
        UUID order=UUID.fromString(confirmed.body().get("orderId").asText());
        String qr=draftQr(order);
        assertTrue(qr.startsWith("TKRUSH:v2:"));
        assertEquals(200,postApi("/api/checkin/scan",f.staffToken(),Map.of("qrPayload",qr)).code());
    }

    @Test
    void twoOrdersUsingOnePassReleaseOnlyOneAdmissionSlot() throws Exception {
        var f=fixture();
        cache.opsForValue().set("queue:pass:"+f.showtime()+":"+f.userId(),"1");
        for (String other : List.of("other-a","other-b")) cache.opsForValue().set("queue:pass:"+f.showtime()+":"+other,"1");
        cache.opsForValue().set("queue:active:"+f.showtime(),"3");
        UUID a=checkout(f,0),b=checkout(f,1);
        assertEquals(200,confirm(f,a).code());
        assertEquals(200,confirm(f,b).code());
        assertEquals("2",cache.opsForValue().get("queue:active:"+f.showtime()));
        queues.releaseSlot(f.showtime(),f.userId().toString());
        assertEquals("2",cache.opsForValue().get("queue:active:"+f.showtime()));
    }

    @Test
    void concurrentReleaseAndRepeatedGrantDoNotDriftCounter() throws Exception {
        var f=fixture(); String user=f.userId().toString();
        parallel(() -> new ApiResult(200,json.valueToTree(queues.checkAndEnqueue(f.showtime(),user))),
                () -> new ApiResult(200,json.valueToTree(queues.checkAndEnqueue(f.showtime(),user))));
        assertEquals("1",cache.opsForValue().get("queue:active:"+f.showtime()));
        parallel(() -> {queues.releaseSlot(f.showtime(),user);return new ApiResult(200,json.nullNode());},
                () -> {queues.releaseSlot(f.showtime(),user);return new ApiResult(200,json.nullNode());});
        assertEquals("0",cache.opsForValue().get("queue:active:"+f.showtime()));
    }

    @Test
    void releaseAfterExpirationDoesNotDecrementTwice() {
        var f=fixture();
        for (String other : List.of("other-a", "other-b")) cache.opsForValue().set("queue:pass:"+f.showtime()+":"+other,"1");
        cache.opsForValue().set("queue:active:"+f.showtime(),"3");
        cache.opsForValue().set("queue:pass:"+f.showtime()+":"+f.userId(),"1",java.time.Duration.ofMillis(100));
        org.awaitility.Awaitility.await().atMost(java.time.Duration.ofSeconds(5)).untilAsserted(() ->
                assertEquals("2",cache.opsForValue().get("queue:active:"+f.showtime())));
        queues.releaseSlot(f.showtime(),f.userId().toString());
        assertEquals("2",cache.opsForValue().get("queue:active:"+f.showtime()));
    }

    @Test
    void overlappingCheckoutsPreserveTheOriginalTicketsAndQuote() throws Exception {
        var f=fixture();
        var request=Map.of("showtimeId",f.showtime(),"seatIds",f.seats());
        var original=postApi("/api/orders/checkout",f.userToken(),request);
        assertEquals(200,original.code());
        UUID order=UUID.fromString(original.body().get("orderId").asText());
        for (var ids : List.of(f.seats(),List.of(f.seats().get(0)))) {
            var overlap=postApi("/api/orders/checkout",f.userToken(),Map.of("showtimeId",f.showtime(),"seatIds",ids));
            assertEquals(400,overlap.code());
        }
        assertEquals(1,db.queryForObject("select count(*) from orders where user_id=?",Integer.class,f.userId()));
        var completed=confirm(f,order);
        assertEquals(200,completed.code());
        assertEquals(2,completed.body().get("selectedSeats").size());
        assertEquals(200000.0,completed.body().get("totalPrice").asDouble());
    }

    @Test
    void simultaneousOverlapsCreateOnlyOneIntactCheckout() throws Exception {
        var f=fixture();var request=Map.of("showtimeId",f.showtime(),"seatIds",f.seats());
        var results=parallel(() -> postApi("/api/orders/checkout",f.userToken(),request),
                () -> postApi("/api/orders/checkout",f.userToken(),request));
        assertEquals(1,results.stream().filter(r -> r.code()==200).count());
        assertEquals(1,results.stream().filter(r -> r.code()==400).count());
        UUID order=UUID.fromString(results.stream().filter(r -> r.code()==200).findFirst().orElseThrow().body().get("orderId").asText());
        var completed=confirm(f,order);
        assertEquals(200,completed.code());
        assertEquals(2,completed.body().get("selectedSeats").size());
        assertEquals(200000.0,completed.body().get("totalPrice").asDouble());
    }

    @Test
    void expiryIsAnExplicitInstantIndependentOfBrowserTimezone() throws Exception {
        var f=fixture();
        var result=postApi("/api/orders/checkout",f.userToken(),Map.of("showtimeId",f.showtime(),"seatIds",f.seats()));
        assertEquals(200,result.code());
        var expiry=java.time.OffsetDateTime.parse(result.body().get("expiresAt").asText()).toInstant();
        var now=java.time.Instant.now();
        assertTrue(expiry.isAfter(now.plusSeconds(540)) && expiry.isBefore(now.plusSeconds(660)));
        assertEquals(expiry,expiry.atZone(java.time.ZoneId.of("Asia/Tokyo")).toInstant());
    }

    static class StompProbe implements java.net.http.WebSocket.Listener, AutoCloseable {
        final java.util.concurrent.LinkedBlockingQueue<String> frames=new java.util.concurrent.LinkedBlockingQueue<>();
        final StringBuilder buffer=new StringBuilder();
        java.net.http.WebSocket socket;
        @Override public void onOpen(java.net.http.WebSocket ws) {ws.request(1);}
        @Override public java.util.concurrent.CompletionStage<?> onText(java.net.http.WebSocket ws,CharSequence data,boolean last) {
            buffer.append(data);
            if(last){frames.add(buffer.toString());buffer.setLength(0);}
            ws.request(1);return java.util.concurrent.CompletableFuture.completedFuture(null);
        }
        String await(String prefix) throws Exception {
            long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);
            while(System.nanoTime()<deadline){
                String frame=frames.poll(100,TimeUnit.MILLISECONDS);
                if(frame!=null && frame.startsWith(prefix))return frame;
            }
            throw new AssertionError("No STOMP frame: "+prefix);
        }
        void open(int port) throws Exception {
            socket=java.net.http.HttpClient.newHttpClient().newWebSocketBuilder().subprotocols("v12.stomp")
                    .buildAsync(java.net.URI.create("ws://127.0.0.1:"+port+"/ws"),this).get(5,TimeUnit.SECONDS);
        }
        void connect(int port) throws Exception {
            connect(port, null);
        }
        void connect(int port, String token) throws Exception {
            open(port);
            String auth = token == null ? "" : "Authorization:Bearer "+token+"\n";
            socket.sendText("CONNECT\naccept-version:1.2\nhost:localhost\nheart-beat:0,0\n"+auth+"\n\0",true).join();
            await("CONNECTED");
        }
        @Override public void close(){if(socket!=null)socket.abort();}
    }

    @Test
    void queueGrantIsDeliveredOnlyToTheAuthenticatedUser() throws Exception {
        var f = fixture();
        User other = new User(); other.setId(UUID.randomUUID()); other.setRole("USER");
        String otherToken = tokens.generateToken(other);
        var subscribed = new CountDownLatch(2);
        org.springframework.context.ApplicationListener<org.springframework.web.socket.messaging.SessionSubscribeEvent> listener =
                event -> subscribed.countDown();
        context.addApplicationListener(listener);
        try (var owner = new StompProbe(); var stranger = new StompProbe()) {
            owner.connect(port, f.userToken());
            stranger.connect(port, otherToken);
            String subscribe = "SUBSCRIBE\nid:user-access\ndestination:/user/queue/access\nack:auto\n\n\0";
            owner.socket.sendText(subscribe, true).join();
            stranger.socket.sendText(subscribe, true).join();
            assertTrue(subscribed.await(5, TimeUnit.SECONDS));
            assertNotNull(wsUsers.getUser(f.userId().toString()), "owner STOMP principal is registered");
            realtime.publishToUser(f.userId().toString(), "/queue/access",
                    Map.of("type", "ACCESS_GRANTED", "showtimeId", f.showtime().toString()));
            String frame = owner.await("MESSAGE");
            assertTrue(frame.contains("ACCESS_GRANTED"));
            assertTrue(frame.contains(f.showtime().toString()));
            String leaked = stranger.frames.poll(1, TimeUnit.SECONDS);
            assertTrue(leaked == null || !leaked.contains("ACCESS_GRANTED"));
        } finally {
            ((org.springframework.context.support.AbstractApplicationContext) context).removeApplicationListener(listener);
        }
    }

    @Test
    void websocketRejectsInvalidAuthenticationToken() throws Exception {
        try (var probe = new StompProbe()) {
            probe.open(port);
            probe.socket.sendText("CONNECT\naccept-version:1.2\nhost:localhost\nheart-beat:0,0\n"
                    + "Authorization:Bearer invalid.jwt.token\n\n\0", true).join();
            probe.await("ERROR");
            String frame = probe.frames.poll(1, TimeUnit.SECONDS);
            assertTrue(frame == null || !frame.startsWith("CONNECTED"));
        }
    }

    @ParameterizedTest
    @ValueSource(strings={"SEND", "MESSAGE"})
    void websocketAllowsPublicSubscriptionsButRejectsClientPublishing(String command) throws Exception {
        String destination="/topic/events/showtimes/"+UUID.randomUUID()+"/seats";
        var subscribed=new CountDownLatch(1);
        org.springframework.context.ApplicationListener<org.springframework.web.socket.messaging.SessionSubscribeEvent> listener=
                event -> subscribed.countDown();
        context.addApplicationListener(listener);
        try(var receiver=new StompProbe();var sender=new StompProbe()) {
            receiver.connect(port);sender.connect(port);
            receiver.socket.sendText("SUBSCRIBE\nid:regression\ndestination:"+destination+"\nack:auto\n\n\0",true).join();
            assertTrue(subscribed.await(5,TimeUnit.SECONDS));
            realtime.publish(destination,Map.of("seatId","SERVER","status","AVAILABLE"));
            assertTrue(receiver.await("MESSAGE").contains("SERVER"));
            sender.socket.sendText(command+"\ndestination:"+destination+"\ncontent-type:application/json\n\n{\"seatId\":\"FORGED\",\"status\":\"SOLD\"}\0",true).join();
            sender.await("ERROR");
            String unexpected=receiver.frames.poll(1,TimeUnit.SECONDS);
            assertTrue(unexpected==null || !unexpected.contains("FORGED"));
        } finally {
            ((org.springframework.context.support.AbstractApplicationContext)context).removeApplicationListener(listener);
        }
    }
}
