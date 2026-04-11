import os

import torch

from misc.imutils import save_image
from .networks import *


class CDEvaluator():

    def __init__(self, args=None, n_class=2, net_G='ChangeFormerV6', embed_dim=256, gpu_ids=[0], checkpoint_dir=None, output_folder=None):
        
        # Support both old 'args' style and new direct parameters
        if args is not None:
            self.n_class = getattr(args, 'n_class', n_class)
            self.gpu_ids = getattr(args, 'gpu_ids', gpu_ids)
            self.checkpoint_dir = getattr(args, 'checkpoint_dir', checkpoint_dir)
            self.output_folder = getattr(args, 'output_folder', output_folder)
            self.net_G_name = getattr(args, 'net_G', net_G)
            self.embed_dim = getattr(args, 'embed_dim', embed_dim)
        else:
            self.n_class = n_class
            self.gpu_ids = gpu_ids
            self.checkpoint_dir = checkpoint_dir
            self.output_folder = output_folder
            self.net_G_name = net_G
            self.embed_dim = embed_dim

        # define G
        self.net_G = define_G(net_G=self.net_G_name, embed_dim=self.embed_dim, gpu_ids=self.gpu_ids)

        self.device = torch.device("cuda:%s" % self.gpu_ids[0]
                                   if torch.cuda.is_available() and len(self.gpu_ids) > 0
                                   else "cpu")

        print(f"Using device: {self.device}")

        if self.output_folder:
            os.makedirs(self.output_folder, exist_ok=True)

    def load_checkpoint(self, checkpoint_path):
        """
        Robustly load checkpoint from a given path.
        """
        if not os.path.exists(checkpoint_path):
            # Try combining with checkpoint_root if available
            if self.checkpoint_dir:
                checkpoint_path = os.path.join(self.checkpoint_dir, checkpoint_path)
            
        if os.path.exists(checkpoint_path):
            print(f"Loading checkpoint from {checkpoint_path}")
            checkpoint = torch.load(checkpoint_path, map_location=self.device, weights_only=False)
            
            # Handle different checkpoint formats (legacy vs modern)
            if 'model_G_state_dict' in checkpoint:
                self.net_G.load_state_dict(checkpoint['model_G_state_dict'])
            else:
                self.net_G.load_state_dict(checkpoint)
                
            self.net_G.to(self.device)
        else:
            raise FileNotFoundError(f'No such checkpoint: {checkpoint_path}')
        return self.net_G


    def _visualize_pred(self):
        pred = torch.argmax(self.G_pred, dim=1, keepdim=True)
        pred_vis = pred * 255
        return pred_vis

    def _forward_pass(self, batch):
        self.batch = batch
        img_in1 = batch['A'].to(self.device)
        img_in2 = batch['B'].to(self.device)
        self.shape_h = img_in1.shape[-2]
        self.shape_w = img_in1.shape[-1]
        self.G_pred = self.net_G(img_in1, img_in2)[-1]
        return self._visualize_pred()

    def eval(self):
        self.net_G.eval()

    def _save_predictions(self):
        """
        保存模型输出结果，二分类图像
        """

        preds = self._visualize_pred()
        name = self.batch['name']
        for i, pred in enumerate(preds):
            file_name = os.path.join(
                self.pred_dir, name[i].replace('.jpg', '.png'))
            pred = pred[0].cpu().numpy()
            save_image(pred, file_name)

