import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from rapidocr_onnxruntime import RapidOCR

ocr = RapidOCR()
img = r'C:\Users\30618\Desktop\蓝牙问题.jpg'
result, elapse = ocr(img)
if result:
    for box, text, score in result:
        print(text)
else:
    print('NO_TEXT_DETECTED')
