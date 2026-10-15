#define _GNU_SOURCE
#include <arpa/inet.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>

struct test_socket {
  int family;
  const char *label;
  int listener;
  int client;
  int accepted;
  unsigned short tcp_port;
};

static void fail(const char *operation) {
  perror(operation);
  exit(1);
}

static socklen_t loopback_addr(int family, unsigned short port,
                               struct sockaddr_storage *out) {
  memset(out, 0, sizeof(*out));
  if (family == AF_INET) {
    struct sockaddr_in *a = (struct sockaddr_in *)out;
    a->sin_family = AF_INET;
    a->sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    a->sin_port = htons(port);
    return sizeof(*a);
  }
  struct sockaddr_in6 *a = (struct sockaddr_in6 *)out;
  a->sin6_family = AF_INET6;
  a->sin6_addr = in6addr_loopback;
  a->sin6_port = htons(port);
  return sizeof(*a);
}

static unsigned short local_port(int fd, int family) {
  struct sockaddr_storage addr;
  socklen_t len = sizeof(addr);
  if (getsockname(fd, (struct sockaddr *)&addr, &len) < 0) fail("getsockname");
  return family == AF_INET
      ? ntohs(((struct sockaddr_in *)&addr)->sin_port)
      : ntohs(((struct sockaddr_in6 *)&addr)->sin6_port);
}

static int bound_socket(int family, int type) {
  struct sockaddr_storage addr;
  socklen_t len = loopback_addr(family, 0, &addr);
  int fd = socket(family, type, 0);
  if (fd < 0) fail("socket");
  if (bind(fd, (struct sockaddr *)&addr, len) < 0) fail("bind");
  return fd;
}

static void preconnect_tcp(struct test_socket *t) {
  struct sockaddr_storage addr;
  t->listener = bound_socket(t->family, SOCK_STREAM);
  if (listen(t->listener, 1) < 0) fail("listen");
  t->tcp_port = local_port(t->listener, t->family);
  socklen_t len = loopback_addr(t->family, t->tcp_port, &addr);
  t->client = socket(t->family, SOCK_STREAM, 0);
  if (t->client < 0) fail("socket TCP client");
  if (connect(t->client, (struct sockaddr *)&addr, len) < 0) fail("connect TCP");
  t->accepted = accept(t->listener, NULL, NULL);
  if (t->accepted < 0) fail("accept");
}

static void send_tcp_after_monitor(const struct test_socket *t) {
  char data;
  if (send(t->client, "R", 1, 0) != 1) fail("send TCP");
  if (recv(t->accepted, &data, 1, 0) != 1 || data != 'R') fail("recv TCP");
  printf("%s TCP_PRECONNECTED_SEND port=%u OK\n", t->label, t->tcp_port);
}

static void send_udp_after_monitor(const struct test_socket *t) {
  int receivers[2] = {bound_socket(t->family, SOCK_DGRAM),
                      bound_socket(t->family, SOCK_DGRAM)};
  unsigned short ports[2] = {local_port(receivers[0], t->family),
                              local_port(receivers[1], t->family)};
  struct sockaddr_storage destinations[2];
  socklen_t lengths[2] = {
      loopback_addr(t->family, ports[0], &destinations[0]),
      loopback_addr(t->family, ports[1], &destinations[1])};
  int sender = socket(t->family, SOCK_DGRAM, 0);
  int connected = socket(t->family, SOCK_DGRAM, 0);
  if (sender < 0 || connected < 0) fail("socket UDP sender");

  if (sendto(sender, "S", 1, 0, (struct sockaddr *)&destinations[0],
             lengths[0]) != 1) fail("sendto UDP");
  struct iovec iov = {.iov_base = (void *)"M", .iov_len = 1};
  struct msghdr msg = {.msg_name = &destinations[0],
                       .msg_namelen = lengths[0],
                       .msg_iov = &iov, .msg_iovlen = 1};
  if (sendmsg(sender, &msg, 0) != 1) fail("sendmsg UDP");

  if (connect(connected, (struct sockaddr *)&destinations[0], lengths[0]) < 0)
    fail("connect UDP");
  if (send(connected, "C", 1, 0) != 1) fail("send connected UDP");
  if (sendto(connected, "T", 1, 0, NULL, 0) != 1)
    fail("sendto connected UDP without address");
  struct iovec connected_iov = {.iov_base = (void *)"N", .iov_len = 1};
  struct msghdr connected_msg = {.msg_iov = &connected_iov, .msg_iovlen = 1};
  if (sendmsg(connected, &connected_msg, 0) != 1)
    fail("sendmsg connected UDP without address");

  struct iovec vectors[2] = {{.iov_base = (void *)"1", .iov_len = 1},
                             {.iov_base = (void *)"2", .iov_len = 1}};
  struct mmsghdr batch[2] = {0};
  for (int i = 0; i < 2; ++i) {
    batch[i].msg_hdr.msg_name = &destinations[i];
    batch[i].msg_hdr.msg_namelen = lengths[i];
    batch[i].msg_hdr.msg_iov = &vectors[i];
    batch[i].msg_hdr.msg_iovlen = 1;
  }
  int sent = sendmmsg(sender, batch, 2, 0);
  if (sent != 2) fail("sendmmsg two UDP messages");
  printf("%s UDP_EXPLICIT_AND_CONNECTED_SEND_SENDTO_SENDMSG_SENDMMSG2 ports=%u,%u OK\n",
         t->label, ports[0], ports[1]);
  close(sender);
  close(connected);
  close(receivers[0]);
  close(receivers[1]);
}

int main(void) {
  struct test_socket tests[2] = {{.family = AF_INET, .label = "IPv4"},
                                 {.family = AF_INET6, .label = "IPv6"}};
  for (int i = 0; i < 2; ++i) preconnect_tcp(&tests[i]);
  printf("CALIBRATION_PID=%ld TCP_PREMONITOR_PORTS IPv4=%u IPv6=%u\n",
         (long)getpid(), tests[0].tcp_port, tests[1].tcp_port);
  puts("Start the owner-controlled monitor now; press Enter here after it is attached.");
  fflush(stdout);
  if (getchar() == EOF) fail("wait for Enter");
  for (int i = 0; i < 2; ++i) {
    send_tcp_after_monitor(&tests[i]);
    send_udp_after_monitor(&tests[i]);
    close(tests[i].client);
    close(tests[i].accepted);
    close(tests[i].listener);
  }
  fflush(stdout);
  return 0;
}
