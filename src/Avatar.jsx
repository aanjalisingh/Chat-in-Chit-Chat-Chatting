export default function Avatar({userId,username,online}){
    const colors = ['bg-red-200' , 'bg-green-200' ,'bg-purple-200' , 'bg-blue-200',
        'bg-yellow-200','bg-teal-200'
    ];
    const userIdBase10=parseInt(userId,16);
    const colorIndex=userIdBase10 % colors.length;
    const color = colors[colorIndex];
    return (
       <div className="w-6 h-6 relative bg-red-200 rounded-full text-center flex items-center">
           <div className="text-center w-full opacity-70">{username[0]}</div> 
           {online &&(
                <div className="absolut w-2 h-2 bg-green-400 bottom-0 right-0 rounded-full border-white"></div>
           )}   
           {!online && (
            <div className="absolut w-2 h-2 bg-gray-400 bottom-0 right-0 rounded-full border-white"></div>

           )}
       </div>
    );
 } 