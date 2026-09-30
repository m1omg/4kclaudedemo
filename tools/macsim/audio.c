// macsim: fake /System/Library/Frameworks/AudioToolbox.framework: a minimal
// AudioQueue on top of ALSA. Checks the stream description and the buffer
// protocol the intro uses.
#include <alsa/asoundlib.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

typedef struct {
	unsigned capacity;
	void *data;
	unsigned size;
	void *user;
	unsigned pd_capacity;
	void *pd;
	unsigned pd_count;
} AQBuffer;

typedef void (*Callback)(void *, void *, AQBuffer *);

typedef struct {
	double rate;
	unsigned id, flags, bytes_per_packet, frames_per_packet, bytes_per_frame, channels, bits, reserved;
} ASBD;

static Callback cb;
static void *cb_user;
static AQBuffer *fifo[64];
static int head, tail;
static pthread_mutex_t mu = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t cv = PTHREAD_COND_INITIALIZER;
static long total;
static struct timespec t0;

int AudioQueueNewOutput(const ASBD *f, Callback c, void *user, void *rl, void *mode, unsigned flags, void **q)
{
	fprintf(stderr, "[macsim] AudioQueueNewOutput rate=%g id=%.4s flags=%u bpp=%u fpp=%u bpf=%u ch=%u bits=%u rl=%p mode=%p fl=%u\n",
		f->rate, (char *)&(unsigned){__builtin_bswap32(f->id)}, f->flags, f->bytes_per_packet, f->frames_per_packet,
		f->bytes_per_frame, f->channels, f->bits, rl, mode, flags);
	if (f->rate != 44100 || f->id != 0x6c70636d || f->flags != 9 || f->bytes_per_frame != 8 || f->channels != 2 || f->bits != 32) {
		fprintf(stderr, "[macsim] unexpected stream format\n");
		exit(3);
	}
	cb = c;
	cb_user = user;
	*q = (void *)0x1234;
	return 0;
}

int AudioQueueAllocateBuffer(void *q, unsigned size, AQBuffer **b)
{
	AQBuffer *x = calloc(1, sizeof *x);
	x->capacity = size;
	x->data = calloc(1, size);
	*b = x;
	fprintf(stderr, "[macsim] AudioQueueAllocateBuffer(%p, %u)\n", q, size);
	return 0;
}

int AudioQueueEnqueueBuffer(void *q, AQBuffer *b, unsigned n, const void *d)
{
	if (q != (void *)0x1234 || n || d || b->size > b->capacity) {
		fprintf(stderr, "[macsim] bad enqueue q=%p n=%u d=%p size=%u\n", q, n, d, b->size);
		exit(3);
	}
	pthread_mutex_lock(&mu);
	fifo[head++ & 63] = b;
	pthread_cond_signal(&cv);
	pthread_mutex_unlock(&mu);
	return 0;
}

static void *player(void *arg)
{
	snd_pcm_t *pcm;
	snd_pcm_open(&pcm, "default", SND_PCM_STREAM_PLAYBACK, 0);
	snd_pcm_set_params(pcm, SND_PCM_FORMAT_FLOAT_LE, SND_PCM_ACCESS_RW_INTERLEAVED, 2, 44100, 1, 100000);
	for (;;) {
		pthread_mutex_lock(&mu);
		while (tail == head) pthread_cond_wait(&cv, &mu);
		AQBuffer *b = fifo[tail++ & 63];
		pthread_mutex_unlock(&mu);
		snd_pcm_writei(pcm, b->data, b->size / 8);
		total += b->size / 8;
		// like a real sound device: never more than 0.1 s ahead of the wall clock
		// (the ALSA null or file devices take data at any speed)
		struct timespec now;
		clock_gettime(CLOCK_MONOTONIC, &now);
		if (!t0.tv_sec) t0 = now;
		double ahead = total / 44100. - ((now.tv_sec - t0.tv_sec) + (now.tv_nsec - t0.tv_nsec) * 1e-9);
		if (ahead > .1) usleep((useconds_t)((ahead - .1) * 1e6));
		cb(cb_user, (void *)0x1234, b);
	}
	return arg;
}

int AudioQueueStart(void *q, const void *t)
{
	pthread_t th;
	fprintf(stderr, "[macsim] AudioQueueStart(%p, %p) with %d buffers queued\n", q, t, head - tail);
	pthread_create(&th, 0, player, 0);
	return 0;
}
