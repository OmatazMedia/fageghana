<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmailTemplate extends Model
{
    protected $table = 'email_templates';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['key', 'name', 'subject', 'blocks', 'is_active'];


    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = \Illuminate\Support\Str::uuid()->toString();
            }
        });
    }
}
