import "./pdfList.css";
import "./pagination.css";
import PdfFile from "./type";


type Props = {
     pdfList: PdfFile[];
     currentPdfList: PdfFile[];
};

const pdfList = (props: Props) => {
    const {pdfList, currentPdfList} = props;
    return (
      <ul className="space-y-3">
          {currentPdfList.map((pdf) => (
            <li 
              key={pdf.id} 
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div>
                <span className="font-medium text-blue-600 block mb-1">
                  {pdf.name}
                </span>
                <span className="text-xs text-gray-400">
                  公開日: {new Date(pdf.createdTime).toLocaleDateString('ja-JP')}
                </span>
              </div>
              <a
                href={`/api/pdf/${pdf.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                開く
              </a>
            </li>
         ))}
    </ul>
  );
};

 export default pdfList;