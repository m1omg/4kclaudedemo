#!/bin/sh
# BRANA Mac test (NOT part of the intro): downloads the variants of the macOS
# intro made by tools/mac/testbuild.py, runs each for 8 seconds and reports
# which ones start. Every variant plays the beginning of the intro full screen;
# nothing needs to be pressed. At the end it prints a summary to paste back.
#
#   curl -sfL https://github.com/m1omg/4kclaudedemo/raw/main/tools/mac/test.sh | sh
URL=https://github.com/m1omg/4kclaudedemo/raw/main/tools/mac/test
cd "$(mktemp -d)" || exit 1
curl -sfLO $URL/list || { echo "cannot download the list of variants"; exit 1; }
n=0
for v in $(cat list); do
	n=$((n + 1))
	if ! curl -sfLO $URL/$v; then
		echo "$n $v: download FAILED" >> results.txt
		continue
	fi
	chmod +x $v
	echo "== $n/$(wc -w < list | tr -d ' '): $v (8 s)"
	./$v > $v.log 2>&1 &
	pid=$!
	sleep 8
	if kill -0 $pid 2>/dev/null; then
		r="ok, still running after 8 s"
	else
		wait $pid
		r="EXITED EARLY with code $?: $(tail -c 300 $v.log | tr '\n' ' ')"
	fi
	pkill -f /tmp/a 2>/dev/null
	kill $pid 2>/dev/null
	wait $pid 2>/dev/null
	echo "$n $v: $r" >> results.txt
	sleep 1
done
echo
echo "results (please paste these lines):"
cat results.txt
