from flask import Flask, render_template
import csv

app = Flask(__name__)

@app.route('/')
def publications():
    # CSVファイルからパブリケーションリストを読み込む
    publications = []
    with open('publications.csv', newline='') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            publications.append(row)
    
    # HTMLテンプレートにデータを渡して表示
    return render_template('index.html', publications=publications)

if __name__ == '__main__':
    app.run(debug=True)
