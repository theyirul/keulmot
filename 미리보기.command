#!/bin/bash
# 클못 사이트 미리보기 (맥용). 더블클릭하면 브라우저가 열린다.
# 윈도우용은 미리보기.bat — 소장님께 드리는 zip 에는 그쪽만 들어간다.
#
# index.html 을 그냥 더블클릭하면 브라우저가 content 폴더 읽기를 막는다.
# 이 작은 서버를 거치면 인터넷에 올린 것과 같은 상태로 보인다.
cd "$(dirname "$0")"

PORT=8123
while lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT+1))
  [ $PORT -gt 8133 ] && { echo "  포트를 못 찾았습니다."; read -r; exit 1; }
done

echo
echo "  ----------------------------------------------"
echo "   미리보기 주소 :  http://localhost:$PORT/"
echo "  ----------------------------------------------"
echo
echo "   * 파일을 고친 뒤에는 브라우저에서 새로고침(⌘R)"
echo "   * 끝내려면 이 창에서 Control+C, 또는 창을 닫으면 됩니다"
echo
sleep 1 && open "http://localhost:$PORT/" &
python3 -m http.server $PORT --bind 127.0.0.1
